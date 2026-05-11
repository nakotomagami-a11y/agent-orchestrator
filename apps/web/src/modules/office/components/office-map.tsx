"use client";

/**
 * Hand-authored two-tier grass island for the new OfficeScene. Tiles are
 * 64-pixel slices from /tiles/grass.png (a 9×6 grid). Each placed tile is
 * absolute-positioned in a relatively-sized container so we can layer:
 * the cliff face under the upper tier draws ON TOP of the lower tier
 * grass it overlaps, instead of replacing it.
 *
 * Layout reads back-to-front: the LOWER list paints first, the UPPER list
 * goes on top, the STAIR list on top of that. Within a list, later items
 * draw later, so cliff-face rows naturally sit in front of grass.
 *
 * Tile-index notes (zero-indexed cols × rows into the tileset):
 *   cols 0-2 / rows 0-2   — low-tier 3×3 grass blob (no cliff)
 *   cols 5-7 / rows 0-2   — high-tier 3×3 grass blob (grass on top, cliff
 *                            face starts on row 2)
 *   cols 5-7 / rows 3-4   — cliff face continuation (pure stone wall)
 *   cols 0,2 / rows 4-5   — staircase L/R walls (the channel between them
 *                            is the implied steps)
 */

const TILE = 64;
const TILESET = "/tiles/grass.png";

type Coord = { c: number; r: number };
type Placed = { c: number; r: number; x: number; y: number };

// Named tile lookup. Coords are *into the tileset image*.
const T = {
  // ─ Low tier (cols 0-2, rows 0-2) ─
  lt_tl: { c: 0, r: 0 },
  lt_t: { c: 1, r: 0 },
  lt_tr: { c: 2, r: 0 },
  lt_l: { c: 0, r: 1 },
  lt_m: { c: 1, r: 1 },
  lt_r: { c: 2, r: 1 },
  lt_bl: { c: 0, r: 2 },
  lt_b: { c: 1, r: 2 },
  lt_br: { c: 2, r: 2 },

  // ─ High tier (cols 5-7, rows 0-2). Row 2 is the grass→cliff transition. ─
  ht_tl: { c: 5, r: 0 },
  ht_t: { c: 6, r: 0 },
  ht_tr: { c: 7, r: 0 },
  ht_l: { c: 5, r: 1 },
  ht_m: { c: 6, r: 1 },
  ht_r: { c: 7, r: 1 },
  ht_bl: { c: 5, r: 2 },
  ht_b: { c: 6, r: 2 },
  ht_br: { c: 7, r: 2 },

  // ─ Cliff face continuation (cols 5-7, rows 3-4). Drawn ON TOP of the
  //   lower tier grass that the high tier sits on. ─
  cf_tl: { c: 5, r: 3 },
  cf_t: { c: 6, r: 3 },
  cf_tr: { c: 7, r: 3 },
  cf_bl: { c: 5, r: 4 },
  cf_b: { c: 6, r: 4 },
  cf_br: { c: 7, r: 4 },

  // ─ Staircase channel walls (cols 0 and 2, rows 4-5). The col-1 middle
  //   is transparent in the tileset — that's where the steps "live". ─
  stair_l: { c: 0, r: 4 },
  stair_r: { c: 2, r: 4 },
  stair_bl: { c: 0, r: 5 },
  stair_br: { c: 2, r: 5 },
} satisfies Record<string, Coord>;

// ─────────────────────────────────────────────────────────────────────────
// Map composition. Coordinates here are grid cells, not pixels — multiplied
// by TILE at render time.
// ─────────────────────────────────────────────────────────────────────────

const MAP_COLS = 12;
const MAP_ROWS = 9;

function row(y: number, xs: { x: number; tile: Coord }[]): Placed[] {
  return xs.map((it) => ({ x: it.x, y, c: it.tile.c, r: it.tile.r }));
}

// Low tier: irregular grass island. Breaks the square by indenting the
// top-left and bottom-right corners with two-tile diagonals, and by
// notching the right side. The rim uses the appropriate corner/edge tiles
// at each transition; interior cells fall back to the centre grass tile.
const LOW_TIER: Placed[] = [
  // Row 0 — narrow top, starts 2 cells in
  ...row(0, [
    { x: 2, tile: T.lt_tl },
    { x: 3, tile: T.lt_t },
    { x: 4, tile: T.lt_t },
    { x: 5, tile: T.lt_t },
    { x: 6, tile: T.lt_t },
    { x: 7, tile: T.lt_t },
    { x: 8, tile: T.lt_t },
    { x: 9, tile: T.lt_tr },
  ]),
  // Row 1 — widens out (extra cell on left)
  ...row(1, [
    { x: 1, tile: T.lt_tl },
    { x: 2, tile: T.lt_m },
    { x: 3, tile: T.lt_m },
    { x: 4, tile: T.lt_m },
    { x: 5, tile: T.lt_m },
    { x: 6, tile: T.lt_m },
    { x: 7, tile: T.lt_m },
    { x: 8, tile: T.lt_m },
    { x: 9, tile: T.lt_r },
  ]),
  // Row 2 — full width
  ...row(2, [
    { x: 0, tile: T.lt_tl },
    { x: 1, tile: T.lt_m },
    { x: 2, tile: T.lt_m },
    { x: 3, tile: T.lt_m },
    { x: 4, tile: T.lt_m },
    { x: 5, tile: T.lt_m },
    { x: 6, tile: T.lt_m },
    { x: 7, tile: T.lt_m },
    { x: 8, tile: T.lt_m },
    { x: 9, tile: T.lt_m },
    { x: 10, tile: T.lt_tr },
  ]),
  // Rows 3-5 — full width interior
  ...row(3, [
    { x: 0, tile: T.lt_l },
    ...Array.from({ length: 10 }, (_, i) => ({ x: i + 1, tile: T.lt_m })),
    { x: 11, tile: T.lt_r },
  ]),
  ...row(4, [
    { x: 0, tile: T.lt_l },
    ...Array.from({ length: 10 }, (_, i) => ({ x: i + 1, tile: T.lt_m })),
    { x: 11, tile: T.lt_r },
  ]),
  ...row(5, [
    { x: 0, tile: T.lt_l },
    ...Array.from({ length: 10 }, (_, i) => ({ x: i + 1, tile: T.lt_m })),
    { x: 11, tile: T.lt_r },
  ]),
  // Row 6 — bay notch on the right (stops 2 cells short)
  ...row(6, [
    { x: 0, tile: T.lt_l },
    { x: 1, tile: T.lt_m },
    { x: 2, tile: T.lt_m },
    { x: 3, tile: T.lt_m },
    { x: 4, tile: T.lt_m },
    { x: 5, tile: T.lt_m },
    { x: 6, tile: T.lt_m },
    { x: 7, tile: T.lt_m },
    { x: 8, tile: T.lt_m },
    { x: 9, tile: T.lt_br },
  ]),
  // Row 7 — narrower bottom
  ...row(7, [
    { x: 0, tile: T.lt_bl },
    { x: 1, tile: T.lt_b },
    { x: 2, tile: T.lt_b },
    { x: 3, tile: T.lt_b },
    { x: 4, tile: T.lt_b },
    { x: 5, tile: T.lt_b },
    { x: 6, tile: T.lt_b },
    { x: 7, tile: T.lt_b },
    { x: 8, tile: T.lt_br },
  ]),
];

// High tier: a 4×3 raised plateau parked in the upper-middle of the island.
// The bottom-of-grass row (ht_bl/ht_b/ht_br) is the visible "lip" where
// the cliff begins; the cliff face below extends 2 more rows and sits in
// front of the low-tier grass.
const HT_X = 4; // grid x where high tier starts
const HT_Y = 1; // grid y where high tier top sits
const HT_W = 4; // width in tiles
const HIGH_TIER: Placed[] = [
  // Row HT_Y — top of grass
  { x: HT_X, y: HT_Y, ...T.ht_tl },
  ...Array.from({ length: HT_W - 2 }, (_, i) => ({
    x: HT_X + 1 + i,
    y: HT_Y,
    ...T.ht_t,
  })),
  { x: HT_X + HT_W - 1, y: HT_Y, ...T.ht_tr },

  // Row HT_Y + 1 — middle grass
  { x: HT_X, y: HT_Y + 1, ...T.ht_l },
  ...Array.from({ length: HT_W - 2 }, (_, i) => ({
    x: HT_X + 1 + i,
    y: HT_Y + 1,
    ...T.ht_m,
  })),
  { x: HT_X + HT_W - 1, y: HT_Y + 1, ...T.ht_r },

  // Row HT_Y + 2 — grass→cliff transition
  { x: HT_X, y: HT_Y + 2, ...T.ht_bl },
  ...Array.from({ length: HT_W - 2 }, (_, i) => ({
    x: HT_X + 1 + i,
    y: HT_Y + 2,
    ...T.ht_b,
  })),
  { x: HT_X + HT_W - 1, y: HT_Y + 2, ...T.ht_br },

  // Row HT_Y + 3 — cliff face middle
  { x: HT_X, y: HT_Y + 3, ...T.cf_tl },
  ...Array.from({ length: HT_W - 2 }, (_, i) => ({
    x: HT_X + 1 + i,
    y: HT_Y + 3,
    ...T.cf_t,
  })),
  { x: HT_X + HT_W - 1, y: HT_Y + 3, ...T.cf_tr },

  // Row HT_Y + 4 — cliff face bottom
  { x: HT_X, y: HT_Y + 4, ...T.cf_bl },
  ...Array.from({ length: HT_W - 2 }, (_, i) => ({
    x: HT_X + 1 + i,
    y: HT_Y + 4,
    ...T.cf_b,
  })),
  { x: HT_X + HT_W - 1, y: HT_Y + 4, ...T.cf_br },
];

// Staircase: a 1-tile-wide × 2-tall channel descending from the high tier.
// Walls bracket the channel; the implied steps are the gap between them.
const STAIR_X = HT_X + HT_W; // right of high tier
const STAIR_Y = HT_Y + 3;
const STAIRS: Placed[] = [
  { x: STAIR_X, y: STAIR_Y, ...T.stair_l },
  { x: STAIR_X + 1, y: STAIR_Y, ...T.stair_r },
  { x: STAIR_X, y: STAIR_Y + 1, ...T.stair_bl },
  { x: STAIR_X + 1, y: STAIR_Y + 1, ...T.stair_br },
];

const ALL_TILES: Placed[] = [...LOW_TIER, ...HIGH_TIER, ...STAIRS];

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
