export const ROOM_W = 1040;
export const ROOM_H = 720;

/** Pod centres in stage coordinates. 4 pods × 4 sides = 16 seats. */
export const PODS: ReadonlyArray<{ cx: number; cy: number }> = [
  { cx: 250, cy: 380 },
  { cx: 720, cy: 380 },
  { cx: 250, cy: 580 },
  { cx: 720, cy: 580 },
];

export type Side = 0 | 1 | 2 | 3;
export type Dir = "N" | "E" | "S" | "W";
export type Rect = { x: number; y: number; w: number; h: number };

export const SVG_OVERLAY_STYLE = {
  position: "absolute" as const,
  inset: 0,
  pointerEvents: "none" as const,
};

export const SVG_BASE_STYLE = {
  position: "absolute" as const,
  inset: 0,
};

export const WORKSTATION_LAYER_STYLE = {
  position: "absolute" as const,
  inset: 0,
  pointerEvents: "none" as const,
};
