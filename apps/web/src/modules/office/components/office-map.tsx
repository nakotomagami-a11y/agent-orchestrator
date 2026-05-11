"use client";

/**
 * Two-tier grass island composed from the Tiny Swords tileset
 * (/tiles/grass.png — a 9×6 grid of 64-px tiles). Two systems run side by
 * side:
 *
 *   - Low tier: declared as a string-art shape; an auto-tile picker
 *     inspects each cell's 4 neighbours and picks the right corner/edge/
 *     interior tile. Adding/removing cells from the shape just works —
 *     no need to hand-pick every rim tile.
 *
 *   - High tier (plateau): hand-placed because it needs the staircase
 *     channel cut into a specific side of the cliff face. The plateau
 *     sits on top of the low tier; the cliff face below the plateau
 *     layers ON TOP of the low-tier grass it covers.
 *
 * Tile coords are guesses calibrated against visual feedback; expect to
 * shift cells if a tile reads wrong. Cliff/grass connection in particular
 * is fiddly — the tileset doesn't ship a clean "grass→cliff" transition
 * row, so the plateau drops straight from grass-middle into cliff-top.
 */

const TILE = 64;
const TILESET = "/tiles/grass.png";

type Coord = { c: number; r: number };
type Placed = { c: number; r: number; x: number; y: number };

const T = {
  // ─ Low-tier 3×3 grass blob (cols 0-2, rows 0-2) ─
  lt_tl: { c: 0, r: 0 },
  lt_t: { c: 1, r: 0 },
  lt_tr: { c: 2, r: 0 },
  lt_l: { c: 0, r: 1 },
  lt_m: { c: 1, r: 1 },
  lt_r: { c: 2, r: 1 },
  lt_bl: { c: 0, r: 2 },
  lt_b: { c: 1, r: 2 },
  lt_br: { c: 2, r: 2 },

  // ─ High-tier 3×3 grass (cols 5-7, rows 0-2) ─
  ht_tl: { c: 5, r: 0 },
  ht_t: { c: 6, r: 0 },
  ht_tr: { c: 7, r: 0 },
  ht_l: { c: 5, r: 1 },
  ht_m: { c: 6, r: 1 },
  ht_r: { c: 7, r: 1 },

  // ─ Cliff face (cols 5-7, rows 3-4). cf_t row has a small grass
  //   overhang at the top — meant to butt directly against grass-middle
  //   on the plateau, no separate "grass-with-bottom-rim" tile needed. ─
  cf_tl: { c: 5, r: 3 },
  cf_t: { c: 6, r: 3 },
  cf_tr: { c: 7, r: 3 },
  cf_bl: { c: 5, r: 4 },
  cf_b: { c: 6, r: 4 },
  cf_br: { c: 7, r: 4 },

  // ─ Staircase channel walls (cols 0 and 2, rows 4-5). Two tiles side by
  //   side render the full stair channel; the middle tileset column is
  //   transparent — that gap is the implied steps. ─
  stair_l: { c: 0, r: 4 },
  stair_r: { c: 2, r: 4 },
  stair_bl: { c: 0, r: 5 },
  stair_br: { c: 2, r: 5 },
} satisfies Record<string, Coord>;

// ─────────────────────────────────────────────────────────────────────────
// Low tier — declarative shape + auto-tile picker
// ─────────────────────────────────────────────────────────────────────────

// '.' = empty, 'X' = grass. Each row only steps in/out by 1 from the
// previous so corner transitions look clean (no single-tile fingers).
const LOW_SHAPE = [
  "..XXXXXXXX..",
  ".XXXXXXXXXX.",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  ".XXXXXXXXXX.",
  "..XXXXXXXX..",
];

const MAP_COLS = LOW_SHAPE[0]!.length;
const MAP_ROWS = LOW_SHAPE.length;

function shapeToGrid(rows: readonly string[]): boolean[][] {
  return rows.map((row) => Array.from(row, (ch) => ch === "X"));
}

/**
 * Pick the right low-tier tile for `(x, y)` given which of its 4 neighbours
 * are off-island. Only handles the basic 9 patterns (4 corners + 4 edges +
 * 1 interior); diagonal-only neighbours fall back to interior since the
 * tileset doesn't ship inner-corner tiles for grass.
 */
function pickLowTier(grid: boolean[][], x: number, y: number): Coord {
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

function buildLowTier(): Placed[] {
  const grid = shapeToGrid(LOW_SHAPE);
  const tiles: Placed[] = [];
  for (let y = 0; y < grid.length; y++) {
    const rowArr = grid[y]!;
    for (let x = 0; x < rowArr.length; x++) {
      if (!rowArr[x]) continue;
      const tile = pickLowTier(grid, x, y);
      tiles.push({ x, y, c: tile.c, r: tile.r });
    }
  }
  return tiles;
}

// ─────────────────────────────────────────────────────────────────────────
// High tier — plateau + staircase
// ─────────────────────────────────────────────────────────────────────────

const HT_X = 4; // plateau left edge (grid col)
const HT_Y = 1; // plateau top edge (grid row)
const HT_W = 5; // plateau width

function buildHighTier(): Placed[] {
  const tiles: Placed[] = [];

  // ─ Grass top row ─
  tiles.push(
    { x: HT_X, y: HT_Y, ...T.ht_tl },
    ...Array.from({ length: HT_W - 2 }, (_, i) => ({
      x: HT_X + 1 + i,
      y: HT_Y,
      ...T.ht_t,
    })),
    { x: HT_X + HT_W - 1, y: HT_Y, ...T.ht_tr },
  );

  // ─ Two interior grass rows for a chunky plateau (no bottom-rim row
  //   — the cliff face's `cf_t` has its own grass overhang at the top
  //   so the transition reads as one continuous lip). ─
  for (let dy = 1; dy <= 2; dy++) {
    tiles.push(
      { x: HT_X, y: HT_Y + dy, ...T.ht_l },
      ...Array.from({ length: HT_W - 2 }, (_, i) => ({
        x: HT_X + 1 + i,
        y: HT_Y + dy,
        ...T.ht_m,
      })),
      { x: HT_X + HT_W - 1, y: HT_Y + dy, ...T.ht_r },
    );
  }

  // ─ Cliff face top row, with the staircase channel occupying the
  //   LEFTMOST two columns. stair_l includes its own left wall so we
  //   don't need a `cf_tl` here. ─
  tiles.push(
    { x: HT_X, y: HT_Y + 3, ...T.stair_l },
    { x: HT_X + 1, y: HT_Y + 3, ...T.stair_r },
    ...Array.from({ length: HT_W - 3 }, (_, i) => ({
      x: HT_X + 2 + i,
      y: HT_Y + 3,
      ...T.cf_t,
    })),
    { x: HT_X + HT_W - 1, y: HT_Y + 3, ...T.cf_tr },
  );

  // ─ Cliff face bottom row ─
  tiles.push(
    { x: HT_X, y: HT_Y + 4, ...T.stair_bl },
    { x: HT_X + 1, y: HT_Y + 4, ...T.stair_br },
    ...Array.from({ length: HT_W - 3 }, (_, i) => ({
      x: HT_X + 2 + i,
      y: HT_Y + 4,
      ...T.cf_b,
    })),
    { x: HT_X + HT_W - 1, y: HT_Y + 4, ...T.cf_br },
  );

  return tiles;
}

const ALL_TILES: Placed[] = [...buildLowTier(), ...buildHighTier()];

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

export function OfficeMap() {
  return (
    <div
      className="office-map"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: MAP_COLS * TILE,
        height: MAP_ROWS * TILE,
        pointerEvents: "none",
      }}
      aria-hidden
    >
      {ALL_TILES.map((t, i) => (
        <div key={i} style={tileStyle(t)} />
      ))}
    </div>
  );
}
