"use client";

/**
 * Hand-authored two-tier grass island for the new OfficeScene. Renders a
 * grid of 64-pixel tiles from the Tiny Swords grass tileset
 * (`/tiles/grass.png`, 9×6 grid of 64px tiles). Tier 1 is a flat grass
 * platform; tier 2 is a raised cliff section sitting on top of it; a
 * staircase connects the two.
 *
 * The tile-index guesses (TILES below) are my first read of the tileset
 * — expect to nudge cells once the visual is in front of us. Each cell is
 * either a `{c, r}` coordinate into the tileset or `null` for "no tile".
 */

const TILE = 64;
const TILESET = "/tiles/grass.png";

type Tile = { c: number; r: number };
type Cell = Tile | null;

// Convenience lookup so the map below reads as a picture instead of a wall
// of coordinate pairs. Names follow "where the cliff edge sits": `tlOut`
// is a top-left outer corner, `r` is the right edge, etc.
const T = {
  // ─ Low tier (cols 0-2, rows 0-2): grass platform with a soft outer rim ─
  tl: { c: 0, r: 0 },
  t: { c: 1, r: 0 },
  tr: { c: 2, r: 0 },
  l: { c: 0, r: 1 },
  m: { c: 1, r: 1 },
  r: { c: 2, r: 1 },
  bl: { c: 0, r: 2 },
  b: { c: 1, r: 2 },
  br: { c: 2, r: 2 },

  // ─ High tier (cols 4-6, rows 0-2): same layout but the bottom row has
  //   the start of the cliff face so the whole block reads "raised". ─
  htl: { c: 4, r: 0 },
  ht: { c: 5, r: 0 },
  htr: { c: 6, r: 0 },
  hl: { c: 4, r: 1 },
  hm: { c: 5, r: 1 },
  hr: { c: 6, r: 1 },
  hbl: { c: 4, r: 2 },
  hb: { c: 5, r: 2 },
  hbr: { c: 6, r: 2 },

  // ─ Cliff face continuation (cols 4-6, rows 3-4): the stone wall the high
  //   tier sits on. Repeats vertically as needed. ─
  cliffTL: { c: 4, r: 3 },
  cliffT: { c: 5, r: 3 },
  cliffTR: { c: 6, r: 3 },
  cliffBL: { c: 4, r: 4 },
  cliffB: { c: 5, r: 4 },
  cliffBR: { c: 6, r: 4 },

  // ─ Staircase (cols 0-1, rows 3-4 area): two tiles tall, descends from
  //   the high tier down to the low tier. ─
  stairTop: { c: 0, r: 3 },
  stairBot: { c: 0, r: 4 },
} as const;

// Two-tier island. Read as a picture: the high tier sits in the upper-left
// portion of the low tier with a small staircase coming down from it.
// `.` is just for readability — null at runtime.
const MAP: Cell[][] = [
  // Low tier outer ring (top)
  [T.tl, T.t, T.t, T.t, T.t, T.t, T.t, T.tr],
  [T.l, T.m, T.m, T.m, T.m, T.m, T.m, T.r],
  // High tier sits on top of low tier interior
  [T.l, T.m, T.htl, T.ht, T.htr, T.m, T.m, T.r],
  [T.l, T.m, T.hl, T.hm, T.hr, T.m, T.m, T.r],
  // Cliff face under the high tier + a stair coming down on the right edge
  [T.l, T.m, T.cliffTL, T.cliffT, T.cliffTR, T.stairTop, T.m, T.r],
  [T.l, T.m, T.m, T.m, T.m, T.stairBot, T.m, T.r],
  [T.bl, T.b, T.b, T.b, T.b, T.b, T.b, T.br],
];

function tileStyle(tile: Tile): React.CSSProperties {
  return {
    width: TILE,
    height: TILE,
    backgroundImage: `url(${TILESET})`,
    backgroundPosition: `-${tile.c * TILE}px -${tile.r * TILE}px`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
  };
}

export function OfficeMap() {
  const cols = Math.max(...MAP.map((row) => row.length));
  const rows = MAP.length;
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
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${TILE}px)`,
        gridTemplateRows: `repeat(${rows}, ${TILE}px)`,
        pointerEvents: "none",
      }}
      aria-hidden
    >
      {MAP.flatMap((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <div key={`${x},${y}`} style={tileStyle(cell)} />
          ) : (
            <div key={`${x},${y}`} style={{ width: TILE, height: TILE }} />
          ),
        ),
      )}
    </div>
  );
}
