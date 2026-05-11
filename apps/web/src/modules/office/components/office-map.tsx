"use client";

import { useState } from "react";
import { UnitSprite } from "@/components/ui/unit-sprite";
import type { OfficeAgent } from "../hooks/use-office-agents";
import {
  DECORATIONS,
  decorationKey,
  familyOf,
  isPlacementValid,
  type DecorationKind,
  type DecorationsMap,
} from "./decorations";
import type { BuildTool } from "./office-build-toolbar";
import {
  AGENT_DRAG_MIME,
  dragRefKey,
  useOfficeDragStore,
  type DragRef,
} from "../hooks/use-office-drag";

/** "x,y" → DragRef. Sparse — cells with no agent aren't keys. */
export type AgentPositions = Record<string, DragRef>;

/**
 * Grass island for the office view. Layout is data-driven: a 2D boolean
 * grid says where grass is, an auto-tile picker selects the right
 * corner/edge/interior tile for each cell based on its 4 neighbours.
 *
 * When `editable` is true, every cell renders as a click target so the
 * builder UI in OfficeScene can place/remove grass. The auto-tile picker
 * runs on every render, so transitions stay clean as the shape changes.
 *
 * Tiles are 64-px slices from /tiles/grass.png (a 9×6 grid). Coords are
 * 0-indexed into that tileset.
 */

const TILE = 64;
const TILESET = "/tiles/grass.png";
const FOAM_SHEET = "/tiles/water-foam.png";
// Each foam frame is the size of 3 tiles per side (192 px), and the sheet
// is one row of 16 frames. The foam sits centred behind a tile so it
// extends one tile-width into the surrounding water in every direction.
const FOAM_FRAME = TILE * 3;
const FOAM_FRAMES = 16;

type Coord = { c: number; r: number };
type Quarter = "tl" | "tr" | "bl" | "br";
type Placed = {
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
  // both left AND right empty — i.e. it's a vertical strip of grass with
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
 *   - 1-wide vertical column (both left AND right empty) — uses the
 *     column-cap tiles in col 3 of the tileset so 1-wide vertical
 *     protrusions get rims on all three exposed sides instead of just
 *     two.
 *
 * Limitation: 1-wide horizontal protrusions and isolated single tiles
 * still fall through to a corner tile and will look "cut" on one side.
 * The tileset doesn't appear to ship dedicated horizontal-cap tiles in
 * an obvious slot — happy to dig further if you hit those shapes.
 */
type Picked = { tile: Coord; rotate?: 0 | 90; quarter?: Quarter };

/**
 * Returns one or more visual layers for a cell. Most cells render as a
 * single tile; the isolated case (all 4 sides water) stacks two `col_mid`
 * tiles — one unrotated for L+R rims, one rotated 90° for T+B rims after
 * rotation — so all four sides get a proper grass edge.
 */
function pickGrass(grid: boolean[][], x: number, y: number): Picked[] {
  const t = !grid[y - 1]?.[x];
  const b = !grid[y + 1]?.[x];
  const l = !grid[y]?.[x - 1];
  const r = !grid[y]?.[x + 1];

  // Isolated single tile — none of the available tiles has rims on all
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

function buildTiles(grid: boolean[][]): Placed[] {
  const tiles: Placed[] = [];
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]!;
    for (let x = 0; x < row.length; x++) {
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
 */
function buildFoam(grid: boolean[][]): Array<{ x: number; y: number }> {
  const foam: Array<{ x: number; y: number }> = [];
  const present = (x: number, y: number) => grid[y]?.[x] === true;
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]!;
    for (let x = 0; x < row.length; x++) {
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

function tileStyle(t: Placed): React.CSSProperties {
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
      backgroundImage: `url(${TILESET})`,
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
    backgroundImage: `url(${TILESET})`,
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
  /** Index of OfficeAgent by id — used to resolve placed agents into a
   *  UnitSprite. Passed in instead of useOfficeAgents'd here so the
   *  component stays presentational. */
  agentsById: Map<string, OfficeAgent>;
  /** When true, render a clickable cell overlay so the builder can edit. */
  editable?: boolean;
  /** Currently-armed tool, used for hover-preview tinting. */
  tool?: BuildTool;
  /** Called with grid coords when the user clicks a cell in editable mode. */
  onCellClick?: (x: number, y: number) => void;
  /** Called when an agent is dropped on a grid cell. Validation (grass
   *  + no overlap with another agent) is the caller's responsibility. */
  onAgentDrop?: (x: number, y: number, ref: DragRef) => void;
  /** Called when the user clicks (not drags) a placed agent. OfficeScene
   *  routes this to either the inspector modal (normal click) or the
   *  erase logic (build mode + erase tool selected). */
  onAgentClick?: (x: number, y: number, ref: DragRef) => void;
};

/**
 * Whether `tool` would actually do something at (x, y). Drives the
 * green/red hover tint in build mode.
 *
 * Decoration placement: invalid if the tool's terrain doesn't match the
 * cell, or if the exact same kind is already in the stack (would be a
 * no-op). Different variants of the same family are valid — they
 * replace the existing family member in place.
 */
function isToolValidAt(
  tool: BuildTool,
  x: number,
  y: number,
  grid: boolean[][],
  decorations: DecorationsMap,
): boolean {
  const cellHasGrass = grid[y]?.[x] === true;
  const stack = decorations[decorationKey(x, y)];
  if (tool === "grass") return !cellHasGrass;
  if (tool === "erase") return cellHasGrass || (stack !== undefined && stack.length > 0);
  if (!isPlacementValid(tool, cellHasGrass)) return false;
  if (stack?.includes(tool)) return false; // already exactly that kind
  return true;
}

export function OfficeMap({
  grid,
  decorations,
  agentPositions,
  agentsById,
  editable = false,
  tool,
  onCellClick,
  onAgentDrop,
  onAgentClick,
}: OfficeMapProps) {
  const cols = grid[0]?.length ?? 0;
  const rows = grid.length;
  const tiles = buildTiles(grid);
  const foam = buildFoam(grid);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const dragging = useOfficeDragStore((s) => s.dragging);
  const setDragging = useOfficeDragStore((s) => s.setDragging);

  // Whether placing the currently-dragged agent at (x, y) would succeed:
  // cell must be grass and not already occupied by a *different* agent
  // (moving the same agent onto its own cell is a no-op but allowed).
  const isAgentDropValid = (x: number, y: number, ref: DragRef): boolean => {
    if (!(grid[y]?.[x] === true)) return false;
    const existing = agentPositions[decorationKey(x, y)];
    if (!existing) return true;
    return dragRefKey(existing) === dragRefKey(ref);
  };

  // Flatten the decoration map into per-cell layers, then sort by cell Y
  // (lower rows draw on top of higher rows for depth). Within a cell the
  // stack order is preserved — solids first, overlays on top — so e.g. a
  // bush placed on a tree's cell paints over the trunk.
  const decoList = Object.entries(decorations).flatMap(([key, stack]) => {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    return stack.map((kind, layer) => ({ x, y, kind, layer }));
  }).sort((a, b) => a.y - b.y || a.layer - b.layer);

  // Build a hover-preview decoration when the user is hovering a cell
  // with a decoration tool armed. Rendered with reduced opacity and a
  // green or red drop-shadow depending on placement validity.
  const previewKind: DecorationKind | null =
    editable &&
    hover &&
    tool &&
    tool !== "grass" &&
    tool !== "erase" &&
    tool in DECORATIONS
      ? (tool as DecorationKind)
      : null;
  const hoverValid =
    editable && hover && tool
      ? isToolValidAt(tool, hover.x, hover.y, grid, decorations)
      : null;

  return (
    <div
      className="office-map"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: cols * TILE,
        height: rows * TILE,
        // Always interactive — placed agents are clickable/draggable
        // regardless of build mode. Inner cell-overlay buttons gate their
        // own behaviour on `editable || dragging` below.
        pointerEvents: "auto",
      }}
      aria-hidden
    >
      {/* Foam first → paints under everything else; the grass tiles cover
          its inner square and only the outward "ring" of the foam frame
          is visible against the water background. */}
      {foam.map((f) => (
        <div
          key={`foam-${f.x}-${f.y}`}
          className="water-foam"
          style={foamStyle(f.x, f.y)}
        />
      ))}
      {tiles.map((t, i) => (
        <div key={`tile-${i}`} style={tileStyle(t)} />
      ))}
      {decoList.map((d) => {
        const def = DECORATIONS[d.kind];
        // Anchor at bottom-centre of the cell: the decoration's bottom
        // edge aligns with the cell's bottom edge, horizontally centred.
        // Tall sprites (trees) extend upward into adjacent cells.
        const left = d.x * TILE + (TILE - def.frameW) / 2;
        const top = (d.y + 1) * TILE - def.frameH;
        return (
          <div
            key={`deco-${decorationKey(d.x, d.y)}-${d.layer}`}
            className={def.animClass}
            aria-label={def.label}
            style={{
              position: "absolute",
              left,
              top,
              width: def.frameW,
              height: def.frameH,
              backgroundImage: `url(${def.src})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "0 0",
              imageRendering: "pixelated",
              pointerEvents: "none",
            }}
          />
        );
      })}
      {/* Placed agents — sorted by y so lower rows draw on top of higher
          rows for natural depth. Skips any ref whose agent isn't in the
          current catalog (e.g. deleted agent, project switched and the
          instance no longer exists). */}
      {Object.entries(agentPositions)
        .map(([key, ref]) => {
          const [xs, ys] = key.split(",");
          return { x: Number(xs), y: Number(ys), ref };
        })
        .sort((a, b) => a.y - b.y)
        .map(({ x, y, ref }) => {
          const agent = agentsById.get(ref.agentId);
          if (!agent) return null;
          // Sit the character centred on the cell, anchored at the
          // bottom so taller frames extend upward.
          const SIZE = 48;
          const left = x * TILE + (TILE - SIZE) / 2;
          const top = (y + 1) * TILE - SIZE;
          // Contextual action: chop only when a tree is to the immediate
          // left or right. Trees above/below don't count — the sprite has
          // no vertical swing, so triggering the chop there would look
          // wrong. Right wins when trees are on both sides; left flips
          // the sprite so the axe swings toward the target.
          const hasTree = (cx: number, cy: number): boolean => {
            const stack = decorations[decorationKey(cx, cy)];
            return !!stack && stack.some((k) => familyOf(k) === "tree");
          };
          const treeRight = hasTree(x + 1, y);
          const treeLeft = hasTree(x - 1, y);
          const chopping = treeRight || treeLeft;
          const action: "idle" | "axe" = chopping ? "axe" : "idle";
          const flip = chopping && !treeRight && treeLeft;
          return (
            <div
              key={`agent-${dragRefKey(ref)}`}
              className="placed-agent"
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
                position: "absolute",
                left,
                top,
                width: SIZE,
                height: SIZE,
                pointerEvents: "auto",
                // The element being dragged needs to be opaque enough to
                // host pointer events but not block the drop targets
                // behind it — they handle their own dragOver detection.
              }}
              aria-label={`${agent.name} — click to open, drag to move`}
              title={agent.name}
            >
              <UnitSprite
                unit={agent.unitChoice}
                size={SIZE}
                action={action}
                flip={flip}
                animate
              />
            </div>
          );
        })}
      {/* Hover preview ghost. During a drag, this is the placed agent's
          sprite; otherwise it's the active decoration tool's sprite. */}
      {dragging && hover
        ? (() => {
            const agent = agentsById.get(dragging.agentId);
            if (!agent) return null;
            const valid = isAgentDropValid(hover.x, hover.y, dragging);
            const tint = valid ? "#22c55e" : "#ef4444";
            const SIZE = 48;
            const left = hover.x * TILE + (TILE - SIZE) / 2;
            const top = (hover.y + 1) * TILE - SIZE;
            return (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left,
                  top,
                  width: SIZE,
                  height: SIZE,
                  pointerEvents: "none",
                  opacity: 0.6,
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
              const top = (hover.y + 1) * TILE - def.frameH;
              const tint = hoverValid ? "#22c55e" : "#ef4444";
              return (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left,
                    top,
                    width: def.frameW,
                    height: def.frameH,
                    backgroundImage: `url(${def.src})`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "0 0",
                    imageRendering: "pixelated",
                    pointerEvents: "none",
                    opacity: 0.6,
                    filter: `drop-shadow(0 0 4px ${tint}) drop-shadow(0 0 2px ${tint})`,
                  }}
                />
              );
            })()
          : null}
      {/* Cell overlay — present when in build mode OR while an agent is
          being dragged. Outside build mode we still need cells to be
          drop targets so users can drop an agent without entering build
          mode first. */}
      {editable || dragging
        ? Array.from({ length: rows }).flatMap((_, y) =>
            Array.from({ length: cols }).map((_, x) => {
              const isHover = hover?.x === x && hover.y === y;
              // Validity during a drag is the agent rule; otherwise the
              // currently-armed build tool rule.
              const valid = dragging
                ? isAgentDropValid(x, y, dragging)
                : tool
                  ? isToolValidAt(tool, x, y, grid, decorations)
                  : false;
              const bg = isHover
                ? valid
                  ? "rgba(34, 197, 94, 0.28)"
                  : "rgba(239, 68, 68, 0.28)"
                : "transparent";
              return (
                <button
                  key={`cell-${x}-${y}`}
                  type="button"
                  onClick={() => {
                    if (!editable) return;
                    onCellClick?.(x, y);
                  }}
                  onMouseEnter={() => setHover({ x, y })}
                  onMouseLeave={() => setHover((h) => (h?.x === x && h.y === y ? null : h))}
                  onDragOver={(e) => {
                    if (!dragging) return;
                    if (Array.from(e.dataTransfer.types).includes(AGENT_DRAG_MIME)) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = valid ? "move" : "none";
                      setHover({ x, y });
                    }
                  }}
                  onDragLeave={() =>
                    setHover((h) => (h?.x === x && h.y === y ? null : h))
                  }
                  onDrop={(e) => {
                    e.preventDefault();
                    const raw = e.dataTransfer.getData(AGENT_DRAG_MIME);
                    if (!raw) return;
                    try {
                      const ref = JSON.parse(raw) as DragRef;
                      if (!isAgentDropValid(x, y, ref)) return;
                      onAgentDrop?.(x, y, ref);
                    } catch {
                      /* malformed payload — ignore */
                    }
                  }}
                  style={{
                    position: "absolute",
                    left: x * TILE,
                    top: y * TILE,
                    width: TILE,
                    height: TILE,
                    background: bg,
                    border: editable
                      ? "1px dashed rgba(255, 255, 255, 0.25)"
                      : "none",
                    cursor: editable ? (valid ? "pointer" : "not-allowed") : "default",
                    padding: 0,
                    transition: "background 80ms ease",
                  }}
                  aria-label={`Cell ${x},${y}`}
                />
              );
            }),
          )
        : null}
    </div>
  );
}
