// Shared constants for the PixiJS office renderer.
import { TILE } from "../components/office-map";

export const FOAM_SHEET = "/tiles/water-foam.png";
export const FOAM_FRAME = TILE * 3; // 192px
export const FOAM_FRAMES = 16;
// Animation speed in PixiJS "frames per ticker frame" (ticker runs at ~60fps).
// CSS: `1.6s steps(16)` = 10fps → 10/60
export const FOAM_ANIM_SPEED = 10 / 60;

// Agent sprite constants
export const AGENT_SIZE = 96;
export const UNIT_ANIM_SPEED = 8 / 60; // 8 fps at ~60fps ticker

// Path tiles are drawn with PixiJS Graphics (no PNG needed).
// Geometry constants — TILE=64, path band is 36px centred, 2px dark border.
export const PATH_M = 14;          // margin: px from tile edge to path edge
export const PATH_P = 36;          // path width in px  (TILE - 2*PATH_M = 36)
export const PATH_B = 2;           // border width in px
export const PATH_C_BORDER = 0x4a2e10; // dark rich brown outline
export const PATH_C_FILL = 0xb8884e;   // warm earthy tan fill
export const PATH_C_LIGHT = 0xd0a86a;  // lighter centre highlight

// Bridge cap auto-render sources
export const BRIDGE_CAP_SRCS = {
  h_l: "/decorations/bridge-h-l.png",
  h_r: "/decorations/bridge-h-r.png",
  v_t: "/decorations/bridge-v-t.png",
  v_b: "/decorations/bridge-v-b.png",
} as const;
