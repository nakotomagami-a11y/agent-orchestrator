"use client";

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
type Placed = { c: number; r: number; x: number; y: number; rotate?: 0 | 90 };

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
type Picked = { tile: Coord; rotate?: 0 | 90 };

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
  // four sides, so layer two col_mid frames at 0° and 90°.
  if (t && b && l && r) {
    return [{ tile: T.col_mid }, { tile: T.col_mid, rotate: 90 }];
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

function tileStyle(t: Placed): React.CSSProperties {
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
  /** When true, render a clickable cell overlay so the builder can edit. */
  editable?: boolean;
  /** Called with grid coords when the user clicks a cell in editable mode. */
  onCellClick?: (x: number, y: number) => void;
};

export function OfficeMap({ grid, editable = false, onCellClick }: OfficeMapProps) {
  const cols = grid[0]?.length ?? 0;
  const rows = grid.length;
  const tiles = buildTiles(grid);
  const foam = buildFoam(grid);

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
        pointerEvents: editable ? "auto" : "none",
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
      {editable
        ? Array.from({ length: rows }).flatMap((_, y) =>
            Array.from({ length: cols }).map((_, x) => (
              <button
                key={`cell-${x}-${y}`}
                type="button"
                onClick={() => onCellClick?.(x, y)}
                style={{
                  position: "absolute",
                  left: x * TILE,
                  top: y * TILE,
                  width: TILE,
                  height: TILE,
                  background: "transparent",
                  border: "1px dashed rgba(255, 255, 255, 0.25)",
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label={`Cell ${x},${y}`}
              />
            )),
          )
        : null}
    </div>
  );
}
