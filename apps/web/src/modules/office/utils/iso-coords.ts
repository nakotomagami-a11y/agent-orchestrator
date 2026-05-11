// Isometric tile geometry — pure math used by both the floor SVG and desk
// placement. A tile is 64w × 32h; the room is COLS×ROWS tiles.

export const TILE_W = 64;
export const TILE_H = 32;
export const COLS = 9;
export const ROWS = 8;

export interface IsoXY { x: number; y: number }

export function isoXY(col: number, row: number): IsoXY {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  };
}

export function stageDimensions(): { width: number; height: number; offsetX: number; offsetY: number } {
  return {
    width: (COLS + ROWS) * (TILE_W / 2) + 80,
    height: (COLS + ROWS) * (TILE_H / 2) + 240,
    offsetX: (ROWS - 1) * (TILE_W / 2) + 40,
    offsetY: 40,
  };
}
