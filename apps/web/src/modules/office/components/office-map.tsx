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
type Placed = { c: number; r: number; x: number; y: number };

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
} satisfies Record<string, Coord>;

/**
 * Pick a grass tile for `(x, y)` from its 4 neighbours' presence. Only
 * handles the basic 9 outer patterns (corners + edges + interior); cells
 * with only diagonal-empty neighbours fall back to interior since the
 * tileset doesn't ship inner-corner tiles.
 */
function pickGrass(grid: boolean[][], x: number, y: number): Coord {
  const t = !grid[y - 1]?.[x];
  const b = !grid[y + 1]?.[x];
  const l = !grid[y]?.[x - 1];
  const r = !grid[y]?.[x + 1];
  if (t && l) return T.lt_tl;
  if (t && r) return T.lt_tr;
  if (b && l) return T.lt_bl;
  if (b && r) return T.lt_br;
  if (t) return T.lt_t;
  if (b) return T.lt_b;
  if (l) return T.lt_l;
  if (r) return T.lt_r;
  return T.lt_m;
}

function buildTiles(grid: boolean[][]): Placed[] {
  const tiles: Placed[] = [];
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]!;
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      const tile = pickGrass(grid, x, y);
      tiles.push({ x, y, c: tile.c, r: tile.r });
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
