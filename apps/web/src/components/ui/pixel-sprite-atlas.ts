/**
 * Pure cell-builder for the 24x32 pixel agent sprite. Ported from
 * design-source/v3/sprites.jsx - kept in this `.utils.ts` so the React
 * component is a thin SVG renderer with no domain logic.
 */

export type SpriteAccessory = "glasses" | "cap" | "headphones" | "earbuds" | null;

export type SpriteSpec = {
  skin?: string;
  hair?: string;
  shirt?: string;
  accessory?: SpriteAccessory;
};

export type SpriteAgent = {
  sprite?: SpriteSpec;
  status?: string;
};

export type SpriteAction = "idle" | "typing";

export type SpriteCell = {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
};

export const SPRITE_W = 24;
export const SPRITE_H = 32;

const PANTS = "#2C001E";
const SHOES = "#1E1A18";

/**
 * Lighten/darken a hex colour. `percent` clamped to [-100, 100]; negative shades
 * toward black, positive toward white. Tiny port of the v3 helper - fast enough
 * to call per-render without memoisation.
 */
export function shadeColor(hex: string, percent: number): string {
  const f = parseInt(hex.slice(1), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const R = f >> 16;
  const G = (f >> 8) & 0x00ff;
  const B = f & 0x0000ff;
  const r = Math.round((t - R) * p) + R;
  const g = Math.round((t - G) * p) + G;
  const b = Math.round((t - B) * p) + B;
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function cell(x: number, y: number, fill: string, w = 1, h = 1): SpriteCell {
  return { x, y, w, h, fill };
}

export type BuiltSprite = {
  cells: SpriteCell[];
  /** True when the keyboard glow / typing-shake animation should run. */
  typing: boolean;
};

export function buildSpriteCells(
  agent: SpriteAgent | undefined,
  action: SpriteAction = "idle",
): BuiltSprite {
  const s = agent?.sprite ?? {};
  const skin = s.skin ?? "#F5C68C";
  const hair = s.hair ?? "#3B2F2A";
  const shirt = s.shirt ?? "#77216F";
  const acc = s.accessory ?? null;

  const skinShade = shadeColor(skin, -18);
  const hairShade = shadeColor(hair, -25);
  const shirtShade = shadeColor(shirt, -22);
  const shirtLight = shadeColor(shirt, 18);

  const cells: SpriteCell[] = [];

  // Hair top (rows 4-7)
  cells.push(cell(8, 4, hair, 8, 1));
  cells.push(cell(7, 5, hair, 10, 1));
  cells.push(cell(7, 6, hair, 10, 1));
  cells.push(cell(7, 7, hair, 1, 1));
  cells.push(cell(16, 7, hair, 1, 1));
  // Face (rows 7-11)
  cells.push(cell(8, 7, skin, 8, 1));
  cells.push(cell(8, 8, skin, 8, 1));
  cells.push(cell(8, 9, skin, 8, 1));
  cells.push(cell(8, 10, skin, 8, 1));
  cells.push(cell(8, 11, skin, 8, 1));
  // Chin shadow
  cells.push(cell(9, 12, skinShade, 6, 1));
  // Hair sides
  cells.push(cell(7, 8, hair, 1, 1));
  cells.push(cell(16, 8, hair, 1, 1));
  cells.push(cell(7, 9, hair, 1, 1));
  cells.push(cell(16, 9, hair, 1, 1));
  // Hair highlight
  cells.push(cell(8, 4, hairShade, 2, 1));
  // Ears
  cells.push(cell(7, 9, skin, 1, 1));
  cells.push(cell(16, 9, skin, 1, 1));
  // Mouth
  cells.push(cell(11, 11, skinShade, 2, 1));

  // Shirt
  cells.push(cell(8, 13, shirt, 8, 1));
  cells.push(cell(7, 14, shirt, 10, 1));
  cells.push(cell(7, 15, shirt, 10, 1));
  cells.push(cell(7, 16, shirt, 10, 1));
  cells.push(cell(7, 17, shirt, 10, 1));
  cells.push(cell(7, 18, shirt, 10, 1));
  // Shirt seam
  cells.push(cell(11, 14, shirtShade, 2, 5));
  // Shirt highlight
  cells.push(cell(8, 13, shirtLight, 1, 1));
  // Arms
  cells.push(cell(6, 15, shirt, 1, 3));
  cells.push(cell(17, 15, shirt, 1, 3));
  // Hands
  cells.push(cell(6, 18, skin, 1, 1));
  cells.push(cell(17, 18, skin, 1, 1));
  // Belt
  cells.push(cell(7, 19, PANTS, 10, 1));
  // Legs
  cells.push(cell(8, 20, PANTS, 3, 4));
  cells.push(cell(13, 20, PANTS, 3, 4));
  // Shoes
  cells.push(cell(8, 24, SHOES, 3, 1));
  cells.push(cell(13, 24, SHOES, 3, 1));

  // Accessories
  if (acc === "glasses") {
    cells.push(cell(8, 9, "#1E1A18", 2, 1));
    cells.push(cell(14, 9, "#1E1A18", 2, 1));
    cells.push(cell(10, 9, "#1E1A18", 4, 1));
  }
  if (acc === "cap") {
    cells.push(cell(7, 4, "#1E1A18", 10, 1));
    cells.push(cell(6, 5, "#1E1A18", 12, 1));
    cells.push(cell(8, 5, shadeColor("#1E1A18", 25), 1, 1));
  }
  if (acc === "headphones") {
    cells.push(cell(6, 6, "#1E1A18", 1, 3));
    cells.push(cell(17, 6, "#1E1A18", 1, 3));
    cells.push(cell(7, 5, "#1E1A18", 10, 1));
  }
  if (acc === "earbuds") {
    cells.push(cell(7, 9, "#FFFFFF", 1, 1));
    cells.push(cell(16, 9, "#FFFFFF", 1, 1));
  }

  const typing = action === "typing" || agent?.status === "working";

  return { cells, typing };
}
