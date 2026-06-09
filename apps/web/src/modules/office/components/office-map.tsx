"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { UnitSprite } from "@/components/ui/unit-sprite";
import type { OfficeAgent } from "../hooks/use-office-agents";
import {
  DECORATIONS,
  decorationKey,
  familyOf,
  hasBridgeCap,
  isPlacementValid,
  type DecorationKind,
  type DecorationsMap,
} from "./decorations";
import type { BuildTool } from "./office-build-toolbar";
import {
  DEFAULT_GRASS_COLOR,
  grassTilesetSrc,
  type GrassColor,
} from "./grass-colors";
import {
  AGENT_DRAG_MIME,
  dragRefKey,
  useOfficeDragStore,
  type DragRef,
} from "../hooks/use-office-drag";
import { getAgentActionAndFlip } from "../utils/agent-action";
import type { AgentInstance } from "@agent-office/shared/types";
import { buildInstanceIndexMap } from "../utils/build-instance-index-map";
import { buildDecoList, buildBridgeCaps } from "../utils/build-map-layers";
import { isAgentDropValid } from "../utils/is-agent-drop-valid";

/** "x,y" → DragRef. Sparse - cells with no agent aren't keys. */
export type AgentPositions = Record<string, DragRef>;

/** Inclusive tile-index bounding box for viewport culling. */
export type VisibleRange = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

/**
 * Grass island for the office view. Layout is data-driven: a 2D boolean
 * grid says where grass is, an auto-tile picker selects the right
 * corner/edge/interior tile for each cell based on its 4 neighbours.
 *
 * When `editable` is true, every cell renders as a click target so the
 * builder UI in OfficeScene can place/remove grass. The auto-tile picker
 * runs on every render, so transitions stay clean as the shape changes.
 *
 * Tiles are 64-px slices from the active grass tileset (a 9×6 grid).
 * The tileset URL is chosen by the island's `grassColor` prop - every
 * color variant shares the exact same layout, so the auto-tile picker
 * doesn't care which one is in use. Coords are 0-indexed into that grid.
 */

export const TILE = 64;
/** Rendered size of a placed-agent sprite (and its drag/hover ghost) in
 *  CSS pixels. The pawn bbox (64×104) scales to this size inside the
 *  square; bigger values let the character extend visibly above the
 *  cell, smaller values shrink it back into the tile. */
export const AGENT_SIZE = 96;
const FOAM_SHEET = "/tiles/water-foam.png";
// Each foam frame is the size of 3 tiles per side (192 px), and the sheet
// is one row of 16 frames. The foam sits centred behind a tile so it
// extends one tile-width into the surrounding water in every direction.
const FOAM_FRAME = TILE * 3;
const FOAM_FRAMES = 16;

type Coord = { c: number; r: number };
type Quarter = "tl" | "tr" | "bl" | "br";
export type Placed = {
  c: number;
  r: number;
  x: number;
  y: number;
  rotate?: 0 | 90;
  /** When set, render only the named 32×32 quadrant of the tile, anchored
   *  to the same quadrant of the destination cell. Used to assemble an
   *  isolated cell from the four corner tiles' matching quadrants. */
  quarter?: Quarter;
};

const T = {
  // Low-tier 3×3 grass blob (cols 0-2, rows 0-2)
  lt_tl: { c: 0, r: 0 },
  lt_t: { c: 1, r: 0 },
  lt_tr: { c: 2, r: 0 },
  lt_l: { c: 0, r: 1 },
  lt_m: { c: 1, r: 1 },
  lt_r: { c: 2, r: 1 },
  lt_bl: { c: 0, r: 2 },
  lt_b: { c: 1, r: 2 },
  lt_br: { c: 2, r: 2 },

  // 1-wide vertical-column variants (col 3, rows 0-2). Used when a cell has
  // both left AND right empty - i.e. it's a vertical strip of grass with
  // water on both sides. Without these the picker would pick a regular
  // corner tile and one side would render as a hard edge ("cut").
  col_top: { c: 3, r: 0 }, // rims on T + L + R, grass opens down
  col_mid: { c: 3, r: 1 }, // rims on L + R only
  col_bot: { c: 3, r: 2 }, // rims on B + L + R, grass opens up
} satisfies Record<string, Coord>;

/**
 * Pick a grass tile for `(x, y)` from its 4 neighbours' presence.
 * Handles:
 *   - 4 outer corners (2 adjacent sides empty)
 *   - 4 edges (1 side empty)
 *   - Interior (all neighbours present)
 *   - 1-wide vertical column (both left AND right empty) - uses the
 *     column-cap tiles in col 3 of the tileset so 1-wide vertical
 *     protrusions get rims on all three exposed sides instead of just
 *     two.
 *
 * Limitation: 1-wide horizontal protrusions and isolated single tiles
 * still fall through to a corner tile and will look "cut" on one side.
 * The tileset doesn't appear to ship dedicated horizontal-cap tiles in
 * an obvious slot - happy to dig further if you hit those shapes.
 */
type Picked = { tile: Coord; rotate?: 0 | 90; quarter?: Quarter };

/**
 * Returns one or more visual layers for a cell. Most cells render as a
 * single tile; the isolated case (all 4 sides water) stacks two `col_mid`
 * tiles - one unrotated for L+R rims, one rotated 90° for T+B rims after
 * rotation - so all four sides get a proper grass edge.
 */
function pickGrass(grid: boolean[][], x: number, y: number): Picked[] {
  const t = !grid[y - 1]?.[x];
  const b = !grid[y + 1]?.[x];
  const l = !grid[y]?.[x - 1];
  const r = !grid[y]?.[x + 1];

  // Isolated single tile - none of the available tiles has rims on all
  // four sides. Assemble one from the four corner tiles' matching
  // quadrants: TL of lt_tl gives a top+left rim corner, TR of lt_tr a
  // top+right, etc. Stitched together they cover all four edges of the
  // cell with their correct decorative scallops.
  if (t && b && l && r) {
    return [
      { tile: T.lt_tl, quarter: "tl" },
      { tile: T.lt_tr, quarter: "tr" },
      { tile: T.lt_bl, quarter: "bl" },
      { tile: T.lt_br, quarter: "br" },
    ];
  }

  // 1-wide vertical (both left AND right empty, but not isolated).
  if (l && r) {
    if (t) return [{ tile: T.col_top }];
    if (b) return [{ tile: T.col_bot }];
    return [{ tile: T.col_mid }];
  }

  // 1-wide horizontal (both top AND bottom empty). Tileset doesn't ship
  // dedicated horizontal caps; rotate the vertical column variants 90°
  // clockwise: col_top → right-cap, col_bot → left-cap, col_mid →
  // horizontal middle.
  if (t && b) {
    if (l) return [{ tile: T.col_bot, rotate: 90 }];
    if (r) return [{ tile: T.col_top, rotate: 90 }];
    return [{ tile: T.col_mid, rotate: 90 }];
  }

  if (t && l) return [{ tile: T.lt_tl }];
  if (t && r) return [{ tile: T.lt_tr }];
  if (b && l) return [{ tile: T.lt_bl }];
  if (b && r) return [{ tile: T.lt_br }];
  if (t) return [{ tile: T.lt_t }];
  if (b) return [{ tile: T.lt_b }];
  if (l) return [{ tile: T.lt_l }];
  if (r) return [{ tile: T.lt_r }];
  return [{ tile: T.lt_m }];
}

export function buildTiles(grid: boolean[][], range?: VisibleRange): Placed[] {
  const tiles: Placed[] = [];
  const yStart = range ? range.yMin : 0;
  const yEnd = range ? Math.min(range.yMax, grid.length - 1) : grid.length - 1;
  for (let y = yStart; y <= yEnd; y++) {
    const row = grid[y]!;
    const xStart = range ? range.xMin : 0;
    const xEnd = range ? Math.min(range.xMax, row.length - 1) : row.length - 1;
    for (let x = xStart; x <= xEnd; x++) {
      if (!row[x]) continue;
      for (const layer of pickGrass(grid, x, y)) {
        tiles.push({
          x,
          y,
          c: layer.tile.c,
          r: layer.tile.r,
          rotate: layer.rotate,
          quarter: layer.quarter,
        });
      }
    }
  }
  return tiles;
}

/**
 * Cells that should have a foam frame painted behind them: grass cells
 * with at least one off-island neighbour in the 8-cell ring. Diagonals
 * count, so outside corners get foam wrapping their concave side.
 * Expands range by 1 in each direction so foam at range edges is included.
 */
export function buildFoam(grid: boolean[][], range?: VisibleRange): Array<{ x: number; y: number }> {
  const foam: Array<{ x: number; y: number }> = [];
  const present = (x: number, y: number) => grid[y]?.[x] === true;
  // Foam divs are 3×3 tiles centred on the cell; include 1-cell margin
  const yStart = range ? Math.max(0, range.yMin - 1) : 0;
  const yEnd = range ? Math.min(grid.length - 1, range.yMax + 1) : grid.length - 1;
  for (let y = yStart; y <= yEnd; y++) {
    const row = grid[y]!;
    const xStart = range ? Math.max(0, range.xMin - 1) : 0;
    const xEnd = range ? Math.min(row.length - 1, range.xMax + 1) : row.length - 1;
    for (let x = xStart; x <= xEnd; x++) {
      if (!row[x]) continue;
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) {
        for (let dx = -1; dx <= 1 && !edge; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (!present(x + dx, y + dy)) edge = true;
        }
      }
      if (edge) foam.push({ x, y });
    }
  }
  return foam;
}

function foamStyle(x: number, y: number): React.CSSProperties {
  // Centre a 3-tile-wide foam frame on the grass tile. The CSS keyframe
  // (.water-foam in globals.css) animates background-position-x across
  // the 16 frames, so every foam element pulses in sync.
  return {
    position: "absolute",
    left: x * TILE - TILE,
    top: y * TILE - TILE,
    width: FOAM_FRAME,
    height: FOAM_FRAME,
    backgroundImage: `url(${FOAM_SHEET})`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "0 0",
    backgroundSize: `${FOAM_FRAME * FOAM_FRAMES}px ${FOAM_FRAME}px`,
    imageRendering: "pixelated",
    pointerEvents: "none",
  };
}

const QUARTER = TILE / 2; // 32

function tileStyle(t: Placed, tileset: string): React.CSSProperties {
  if (t.quarter) {
    // Render only the named 32×32 quadrant of the source tile, anchored
    // to the same quadrant of the destination cell.
    const qx = t.quarter === "tr" || t.quarter === "br" ? QUARTER : 0;
    const qy = t.quarter === "bl" || t.quarter === "br" ? QUARTER : 0;
    return {
      position: "absolute",
      left: t.x * TILE + qx,
      top: t.y * TILE + qy,
      width: QUARTER,
      height: QUARTER,
      backgroundImage: `url(${tileset})`,
      backgroundPosition: `-${t.c * TILE + qx}px -${t.r * TILE + qy}px`,
      backgroundRepeat: "no-repeat",
      imageRendering: "pixelated",
    };
  }
  return {
    position: "absolute",
    left: t.x * TILE,
    top: t.y * TILE,
    width: TILE,
    height: TILE,
    backgroundImage: `url(${tileset})`,
    backgroundPosition: `-${t.c * TILE}px -${t.r * TILE}px`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
    transform: t.rotate ? `rotate(${t.rotate}deg)` : undefined,
  };
}

export type OfficeMapProps = {
  grid: boolean[][];
  decorations: DecorationsMap;
  agentPositions: AgentPositions;
  /** Index of OfficeAgent by id - used to resolve placed agents into a
   *  UnitSprite. Passed in instead of useOfficeAgents'd here so the
   *  component stays presentational. */
  agentsById: Map<string, OfficeAgent>;
  /** Island-wide grass color. Selects which 9×6 tileset PNG to source
   *  every grass tile from. Defaults to the original yellow-green. */
  grassColor?: GrassColor;
  /** When true, render a clickable cell overlay so the builder can edit. */
  editable?: boolean;
  /** Currently-armed tool, used for hover-preview tinting. */
  tool?: BuildTool | null;
  /** Called with grid coords when the user clicks a cell in editable mode. */
  onCellClick?: (x: number, y: number, shiftKey?: boolean) => void;
  /** Called when an agent is dropped on a grid cell. Validation (grass
   *  + no overlap with another agent) is the caller's responsibility. */
  onAgentDrop?: (x: number, y: number, ref: DragRef) => void;
  /** Called when the user clicks (not drags) a placed agent. OfficeScene
   *  routes this to either the inspector modal (normal click) or the
   *  erase logic (build mode + erase tool selected). */
  onAgentClick?: (x: number, y: number, ref: DragRef) => void;
  /** When non-empty, dims agents whose name doesn't include this string. */
  agentSearch?: string;
  /**
   * Project roster instances. When set and `isMultiInstance` is true,
   * a small `#N` badge is rendered on workstations for instances beyond #1.
   */
  rosterInstances?: AgentInstance[];
  /** When true, instance badges are shown (feature flag gate). */
  isMultiInstance?: boolean;
  /** Per-instance spend keyed `"agentId|instanceId"`. Used to show spend under desks. */
  spendByInstance?: Record<string, number>;
  /** Inclusive cell range that's currently in the viewport. Only cells within
   *  this range are rendered. Omitting disables culling (full render). */
  visibleRange?: VisibleRange;
};

/**
 * Whether `tool` would actually do something at (x, y). Drives the
 * green/red hover tint in build mode.
 *
 * Decoration placement: invalid if the tool's terrain doesn't match the
 * cell, or if the exact same kind is already in the stack (would be a
 * no-op). Different variants of the same family are valid - they
 * replace the existing family member in place.
 */
export function isToolValidAt(
  tool: BuildTool,
  x: number,
  y: number,
  grid: boolean[][],
  decorations: DecorationsMap,
): boolean {
  const cellHasGrass = grid[y]?.[x] === true;
  const stack = decorations[decorationKey(x, y)];
  if (tool === "grass") return !cellHasGrass;
  if (tool === "fill") return !cellHasGrass;
  if (tool === "erase") return cellHasGrass || (stack !== undefined && stack.length > 0);
  if (!isPlacementValid(tool, cellHasGrass)) return false;
  if (stack?.includes(tool)) return false; // already exactly that kind
  // Cells acting as a bridge ramp are reserved for the cap - block any
  // new decoration placement there.
  if (hasBridgeCap(x, y, grid, decorations)) return false;
  return true;
}

export type GridCellProps = {
  x: number;
  y: number;
  isHovered: boolean;
  isValid: boolean;
  isEditable: boolean;
  onEnter: (x: number, y: number) => void;
  onLeave: (x: number, y: number) => void;
  onClick: (x: number, y: number, shiftKey: boolean) => void;
  onDragOver: (x: number, y: number, e: React.DragEvent<HTMLButtonElement>, isValid: boolean) => void;
  onDragLeave: (x: number, y: number) => void;
  onDrop: (x: number, y: number, e: React.DragEvent<HTMLButtonElement>) => void;
};

/** Memoised overlay cell for build mode. Isolating hover into a prop means
 *  only the 2 cells that change (old hover → new hover) re-render per cursor
 *  move instead of the entire visible grid. All callbacks are stable refs. */
export const GridCell = memo(function GridCell({
  x,
  y,
  isHovered,
  isValid,
  isEditable,
  onEnter,
  onLeave,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: GridCellProps) {
  return (
    <button
      type="button"
      onClick={(e) => onClick(x, y, e.shiftKey)}
      onMouseEnter={() => onEnter(x, y)}
      onMouseLeave={() => onLeave(x, y)}
      onDragOver={(e) => onDragOver(x, y, e, isValid)}
      onDragLeave={() => onDragLeave(x, y)}
      onDrop={(e) => onDrop(x, y, e)}
      className="absolute p-0 pointer-events-auto transition-[background] duration-[80ms] ease-[ease]"
      style={{
        left: x * TILE,
        top: y * TILE,
        width: TILE,
        height: TILE,
        background: isHovered
          ? isValid
            ? "rgba(34, 197, 94, 0.28)"
            : "rgba(239, 68, 68, 0.28)"
          : "transparent",
        border: isEditable ? "1px dashed rgba(255, 255, 255, 0.25)" : "none",
        cursor: isEditable ? (isValid ? "pointer" : "not-allowed") : "default",
      }}
      aria-label={`Cell ${x},${y}`}
    />
  );
});

function OfficeMapInner({
  grid,
  decorations,
  agentPositions,
  agentsById,
  grassColor = DEFAULT_GRASS_COLOR,
  editable = false,
  tool,
  agentSearch = "",
  onCellClick,
  onAgentDrop,
  onAgentClick,
  rosterInstances = [],
  isMultiInstance = false,
  spendByInstance = {},
  visibleRange,
}: OfficeMapProps) {
  const cols = grid[0]?.length ?? 0;
  const rows = grid.length;
  const tileset = grassTilesetSrc(grassColor);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const dragging = useOfficeDragStore((s) => s.dragging);
  const setDragging = useOfficeDragStore((s) => s.setDragging);

  // Ref updated every render so stable cell callbacks always see current
  // grid/props without being recreated (which would defeat GridCell.memo).
  const cellStateRef = useRef({ grid, decorations, agentPositions, dragging, tool, editable, onCellClick, onAgentDrop });
  cellStateRef.current = { grid, decorations, agentPositions, dragging, tool, editable, onCellClick, onAgentDrop };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableOnEnter = useCallback((x: number, y: number) => setHover({ x, y }), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableOnLeave = useCallback((x: number, y: number) => {
    setHover((h) => (h?.x === x && h.y === y ? null : h));
  }, []);
  const stableOnClick = useCallback((x: number, y: number, shiftKey: boolean) => {
    const s = cellStateRef.current;
    if (!s.editable) return;
    s.onCellClick?.(x, y, shiftKey);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableOnDragOver = useCallback((x: number, y: number, e: React.DragEvent, isValid: boolean) => {
    if (!cellStateRef.current.dragging) return;
    if (Array.from(e.dataTransfer.types).includes(AGENT_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = isValid ? "move" : "none";
      setHover({ x, y });
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableOnDragLeave = useCallback((x: number, y: number) => {
    setHover((h) => (h?.x === x && h.y === y ? null : h));
  }, []);
  const stableOnDrop = useCallback((x: number, y: number, e: React.DragEvent) => {
    e.preventDefault();
    const { grid: g, decorations: d, agentPositions: ap, onAgentDrop: drop } = cellStateRef.current;
    const raw = e.dataTransfer.getData(AGENT_DRAG_MIME);
    if (!raw) return;
    try {
      const ref = JSON.parse(raw) as DragRef;
      const isGrass = g[y]?.[x] === true;
      if (!isGrass) {
        const stack = d[decorationKey(x, y)];
        if (!stack || !stack.some((k) => familyOf(k) === "bridge")) return;
      }
      const existing = ap[decorationKey(x, y)];
      if (existing && dragRefKey(existing) !== dragRefKey(ref)) return;
      drop?.(x, y, ref);
    } catch { /* malformed drag payload */ }
  }, []);

  // Pre-compute per-agent instance index for badge rendering.
  const instanceIndexMap = useMemo(
    () => buildInstanceIndexMap(isMultiInstance, rosterInstances),
    [isMultiInstance, rosterInstances],
  );

  const tiles = useMemo(() => buildTiles(grid, visibleRange), [grid, visibleRange]);
  const foam = useMemo(() => buildFoam(grid, visibleRange), [grid, visibleRange]);

  const decoList = useMemo(
    () => buildDecoList(decorations, visibleRange),
    [decorations, visibleRange],
  );

  const bridgeCaps = useMemo(
    () => buildBridgeCaps(decorations, grid, visibleRange),
    [decorations, grid, visibleRange],
  );

  const visibleAgents = useMemo(() => {
    return Object.entries(agentPositions)
      .map(([key, ref]) => {
        const [xs, ys] = key.split(",");
        return { x: Number(xs), y: Number(ys), ref };
      })
      .filter(({ x, y }) => !visibleRange || (x >= visibleRange.xMin && x <= visibleRange.xMax && y >= visibleRange.yMin && y <= visibleRange.yMax))
      .sort((a, b) => a.y - b.y);
  }, [agentPositions, visibleRange]);

  // Pre-compute which cells are valid targets for the current tool/drag so the
  // render loop does O(1) Set lookups instead of calling isToolValidAt (which
  // walks the decorations map via hasBridgeCap) for every visible cell on every
  // hover state change. Only recomputes when the underlying data changes, NOT
  // on every cursor move.
  //
  // For grass/fill/erase: validity is a simple grid-cell check (no hasBridgeCap
  // needed), so we return a sentinel string and compute inline in the render
  // loop — this skips the O(visible_area) Set construction on every paint.
  const validitySet = useMemo(() => {
    if (!editable && !dragging) return null;
    if (!dragging) {
      if (tool === "grass" || tool === "fill") return "inline-grass" as const;
      if (tool === "erase") return "inline-erase" as const;
    }
    const vsYStart = visibleRange?.yMin ?? 0;
    const vsYEnd = visibleRange?.yMax ?? (grid.length - 1);
    const vsXStart = visibleRange?.xMin ?? 0;
    const vsXEnd = visibleRange?.xMax ?? ((grid[0]?.length ?? 0) - 1);
    const set = new Set<string>();
    for (let cy = vsYStart; cy <= vsYEnd; cy++) {
      for (let cx = vsXStart; cx <= vsXEnd; cx++) {
        let valid: boolean;
        if (dragging) {
          const isGrass = grid[cy]?.[cx] === true;
          if (!isGrass) {
            const stack = decorations[decorationKey(cx, cy)];
            const hasBridge = !!stack && stack.some((k) => familyOf(k) === "bridge");
            if (!hasBridge) {
              valid = false;
            } else {
              const existing = agentPositions[decorationKey(cx, cy)];
              valid = !existing || dragRefKey(existing) === dragRefKey(dragging);
            }
          } else {
            const existing = agentPositions[decorationKey(cx, cy)];
            valid = !existing || dragRefKey(existing) === dragRefKey(dragging);
          }
        } else {
          valid = tool ? isToolValidAt(tool, cx, cy, grid, decorations) : false;
        }
        if (valid) set.add(decorationKey(cx, cy));
      }
    }
    return set;
  }, [tool, grid, decorations, agentPositions, editable, dragging, visibleRange]);

  // Build a hover-preview decoration when the user is hovering a cell
  // with a decoration tool armed. Rendered with reduced opacity and a
  // green or red drop-shadow depending on placement validity.
  const previewKind: DecorationKind | null =
    editable &&
    hover &&
    tool &&
    tool !== "grass" &&
    tool !== "erase" &&
    tool !== "fill" &&
    tool in DECORATIONS
      ? (tool as DecorationKind)
      : null;
  const hoverValid =
    editable && hover && tool
      ? isToolValidAt(tool, hover.x, hover.y, grid, decorations)
      : null;

  // Cell overlay range: cull to visible range to avoid 1040-button DOM
  const yStart = visibleRange?.yMin ?? 0;
  const yEnd = visibleRange?.yMax ?? rows - 1;
  const xStart = visibleRange?.xMin ?? 0;
  const xEnd = visibleRange?.xMax ?? cols - 1;

  return (
    <div
      className="office-map absolute left-0 top-0 pointer-events-auto"
      style={{
        width: cols * TILE,
        height: rows * TILE,
      }}
      aria-hidden
    >
      {/* Foam first → paints under everything else; the grass tiles cover
          its inner square and only the outward "ring" of the foam frame
          is visible against the water background. */}
      {foam.map((f) => (
        <div
          key={`foam-${f.x}-${f.y}`}
          className="animate-[water-foam_1.6s_steps(16)_infinite]"
          style={foamStyle(f.x, f.y)}
        />
      ))}
      {tiles.map((t) => (
        <div key={`tile-${t.x}-${t.y}-${t.quarter ?? "f"}-${t.c}-${t.r}`} style={tileStyle(t, tileset)} />
      ))}
      {decoList.map((d) => {
        const def = DECORATIONS[d.kind];
        // Anchoring is per-decoration. Default "bottom" keeps trees,
        // houses and other rooted sprites where they were. "center"
        // (sheep) places the sprite's centre on the cell's centre so
        // free-standing creatures don't appear to hang from the tile's
        // top edge.
        const left = d.x * TILE + (TILE - def.frameW) / 2;
        const top =
          def.anchor === "center"
            ? d.y * TILE + (TILE - def.frameH) / 2
            : (d.y + 1) * TILE - def.frameH;
        return (
          <div
            key={`deco-${decorationKey(d.x, d.y)}-${d.layer}`}
            className={`${def.animClass} absolute pointer-events-none`}
            aria-label={def.label}
            style={{
              left,
              top,
              width: def.frameW,
              height: def.frameH,
              backgroundImage: `url(${def.src})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "0 0",
              imageRendering: "pixelated",
            }}
          />
        );
      })}
      {/* Auto bridge end-caps. Painted after the regular decoration pass
          so they overlay any land decorations on the cap cell. They live
          on land tiles adjacent to a placed bridge middle, with the
          transparent half of the sprite facing away from the bridge. */}
      {bridgeCaps.map((cap, i) => (
        <div
          key={`bridge-cap-${i}-${cap.x}-${cap.y}`}
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            left: cap.x * TILE,
            top: cap.y * TILE,
            width: TILE,
            height: TILE,
            backgroundImage: `url(${cap.src})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "0 0",
            imageRendering: "pixelated",
          }}
        />
      ))}
      {/* Placed agents - sorted by y so lower rows draw on top of higher
          rows for natural depth. Skips any ref whose agent isn't in the
          current catalog (e.g. deleted agent, project switched and the
          instance no longer exists). */}
      {visibleAgents.map(({ x, y, ref }) => {
          const agent = agentsById.get(ref.agentId);
          if (!agent) return null;
          // Sit the character symmetrically centred on the cell. With
          // SIZE > TILE the sprite overflows by (SIZE-TILE)/2 on every
          // side, so the head sits above the cell and the feet just
          // below - the character looks anchored to the middle of the
          // tile rather than its bottom edge.
          const SIZE = AGENT_SIZE;
          const left = x * TILE + (TILE - SIZE) / 2;
          const bridgeStack = decorations[decorationKey(x, y)];
          const onBridge = (grid[y]?.[x] !== true && !!bridgeStack && bridgeStack.some((k) => familyOf(k) === "bridge")) || hasBridgeCap(x, y, grid, decorations);
          const top = y * TILE + (TILE - SIZE) / 2 - (onBridge ? Math.round(TILE * 0.35) : 0);
          // Animation rule: agents idle by default and only switch to a
          // work animation while they're actively running a task. The
          // work animation is picked from nearby resources:
          //   - tree on same tile OR 1-2 cells below (trees are 256 px tall
          //     and anchor at their base; an agent placed in the canopy area
          //     visually appears on the tree) → axe
          //   - rock on same tile only (rocks are exactly 64×64 - one tile;
          //     no look-down needed) → pickaxe
          //   - sheep on left/right neighbour (same row) → knife
          //     (sheep on the same tile does NOT count - the shearing
          //     pose only makes sense when there's something to swing
          //     at on the side. Sheep on left flips the sprite so the
          //     knife faces the target.)
          //   - none of the above → hammer (generic build pose)
          const isWorking =
            agent.status === "working" || agent.status === "thinking";
          const { action, flip } = getAgentActionAndFlip(x, y, isWorking, decorations);
          const searchMatch = !agentSearch || agent.name.toLowerCase().includes(agentSearch.toLowerCase());
          // Instance badge: show #N for any instance beyond the first
          const instanceIdx = ref.instanceId ? instanceIndexMap.get(ref.instanceId) : undefined;
          const showBadge = isMultiInstance && instanceIdx !== undefined && instanceIdx > 1;
          // Spend pill
          const spendKey = ref.instanceId ? `${ref.agentId}|${ref.instanceId}` : null;
          const instSpend = spendKey ? (spendByInstance[spendKey] ?? 0) : 0;
          const showSpend = isMultiInstance && instSpend > 0;
          return (
            <div
              key={`agent-${dragRefKey(ref)}`}
              className="cursor-grab transition-[transform,filter,opacity] duration-100 ease-linear hover:scale-[1.12] hover:drop-shadow-[0_0_6px_#fbbf24] hover:z-[5] active:cursor-grabbing absolute pointer-events-auto"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(AGENT_DRAG_MIME, JSON.stringify(ref));
                e.dataTransfer.setData("text/plain", ref.agentId);
                e.dataTransfer.effectAllowed = "move";
                setDragging(ref);
              }}
              onDragEnd={() => setDragging(null)}
              onClick={() => onAgentClick?.(x, y, ref)}
              style={{
                left,
                top,
                width: SIZE,
                height: SIZE,
                opacity: searchMatch ? 1 : 0.2,
              }}
              aria-label={`${agent.name}${instanceIdx ? ` #${instanceIdx}` : ""} - click to open, drag to move`}
              title={`${agent.name}${instanceIdx ? ` #${instanceIdx}` : ""}`}
            >
              <UnitSprite
                unit={agent.unitChoice}
                size={SIZE}
                action={action}
                flip={flip}
                animate
              />
              {/* Instance index badge — bottom-right of sprite, only for #2+ */}
              {showBadge && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    background: "rgba(20,16,14,0.82)",
                    color: "rgba(244,239,234,0.88)",
                    borderRadius: 4,
                    fontSize: 9,
                    fontFamily: "var(--font-mono, monospace)",
                    fontWeight: 600,
                    lineHeight: 1,
                    padding: "2px 4px",
                    letterSpacing: "0.04em",
                    border: "1px solid rgba(255,240,230,0.18)",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  #{instanceIdx}
                </span>
              )}
              {/* Spend pill — below the badge / bottom area */}
              {showSpend && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: showBadge ? 18 : 2,
                    right: 2,
                    background: "rgba(20,16,14,0.82)",
                    color: "rgba(180,220,180,0.9)",
                    borderRadius: 4,
                    fontSize: 9,
                    fontFamily: "var(--font-mono, monospace)",
                    fontWeight: 600,
                    lineHeight: 1,
                    padding: "2px 4px",
                    letterSpacing: "0.04em",
                    border: "1px solid rgba(34,197,94,0.25)",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  ${instSpend.toFixed(2)}
                </span>
              )}
            </div>
          );
        })}
      {/* Hover preview ghost. During a drag, this is the placed agent's
          sprite; otherwise it's the active decoration tool's sprite. */}
      {dragging && hover
        ? (() => {
            const agent = agentsById.get(dragging.agentId);
            if (!agent) return null;
            const valid = isAgentDropValid(hover.x, hover.y, dragging, grid, decorations, agentPositions);
            const tint = valid ? "#22c55e" : "#ef4444";
            const SIZE = AGENT_SIZE;
            const left = hover.x * TILE + (TILE - SIZE) / 2;
            const top = hover.y * TILE + (TILE - SIZE) / 2;
            return (
              <div
                aria-hidden
                className="absolute pointer-events-none opacity-60"
                style={{
                  left,
                  top,
                  width: SIZE,
                  height: SIZE,
                  filter: `drop-shadow(0 0 4px ${tint}) drop-shadow(0 0 2px ${tint})`,
                }}
              >
                <UnitSprite
                  unit={agent.unitChoice}
                  size={SIZE}
                  action="idle"
                  animate={false}
                />
              </div>
            );
          })()
        : previewKind && hover && hoverValid !== null
          ? (() => {
              const def = DECORATIONS[previewKind];
              const left = hover.x * TILE + (TILE - def.frameW) / 2;
              const top =
                def.anchor === "center"
                  ? hover.y * TILE + (TILE - def.frameH) / 2
                  : (hover.y + 1) * TILE - def.frameH;
              const tint = hoverValid ? "#22c55e" : "#ef4444";
              return (
                <div
                  aria-hidden
                  className="absolute pointer-events-none opacity-60"
                  style={{
                    left,
                    top,
                    width: def.frameW,
                    height: def.frameH,
                    backgroundImage: `url(${def.src})`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "0 0",
                    imageRendering: "pixelated",
                    filter: `drop-shadow(0 0 4px ${tint}) drop-shadow(0 0 2px ${tint})`,
                  }}
                />
              );
            })()
          : null}
      {/* Cell overlay - present when in build mode OR while an agent is
          being dragged. Outside build mode we still need cells to be
          drop targets so users can drop an agent without entering build
          mode first. Culled to visibleRange to keep DOM count low.
          GridCell is memoised: only the 2 cells changing hover state
          re-render per cursor move instead of the whole visible grid. */}
      {editable || dragging
        ? Array.from({ length: yEnd - yStart + 1 }).flatMap((_, i) => {
            const y = yStart + i;
            return Array.from({ length: xEnd - xStart + 1 }).map((_, j) => {
              const x = xStart + j;
              let valid: boolean;
              if (!validitySet) {
                valid = false;
              } else if (validitySet === "inline-grass") {
                valid = grid[y]?.[x] !== true;
              } else if (validitySet === "inline-erase") {
                valid = grid[y]?.[x] === true || !!decorations[decorationKey(x, y)];
              } else {
                valid = validitySet.has(decorationKey(x, y));
              }
              return (
                <GridCell
                  key={`cell-${x}-${y}`}
                  x={x}
                  y={y}
                  isHovered={hover?.x === x && hover.y === y}
                  isValid={valid}
                  isEditable={editable}
                  onEnter={stableOnEnter}
                  onLeave={stableOnLeave}
                  onClick={stableOnClick}
                  onDragOver={stableOnDragOver}
                  onDragLeave={stableOnDragLeave}
                  onDrop={stableOnDrop}
                />
              );
            });
          })
        : null}
    </div>
  );
}

export const OfficeMap = memo(OfficeMapInner);

// OfficeMapOverlay has moved to ./office-map-overlay.tsx
// Re-exported here for backwards-compatible imports in office-scene.tsx.
export type { OfficeMapOverlayProps } from "./office-map-overlay";
export { OfficeMapOverlay } from "./office-map-overlay";

