/**
 * Decoration catalog for the office scene. Each entry defines:
 *   - which terrain it can be placed on (land = grass cell, water = empty)
 *   - the source sprite sheet
 *   - native frame size (one frame of the sheet)
 *   - rendered display size (how big it shows in the scene; trees scale
 *     down a touch, the duck scales up to be readable)
 *   - the CSS class that drives the per-frame animation (declared in
 *     globals.css)
 *
 * Decorations are anchored at the BOTTOM-CENTRE of their grid cell. Tall
 * sprites (trees) extend upward into adjacent cells visually but only
 * occupy the one cell logically — clicks always target the anchor cell.
 */

export type Terrain = "land" | "water";
export type DecorationKind = "bush" | "rock" | "tree" | "water_rock" | "duck";

export interface DecorationDef {
  label: string;
  src: string;
  /** Width of a single frame in the sprite sheet. Also the rendered width
   *  — decorations render at native size so the keyframe shift values
   *  (declared in globals.css) line up without scaling math. */
  frameW: number;
  frameH: number;
  /** Total frame count in the sheet — used to size the background so the
   *  full strip is available for `background-position-x` to slide across. */
  frames: number;
  terrain: Terrain;
  /** CSS class on the rendered <div> that drives the per-frame animation
   *  via keyframes declared in globals.css. Omit for static sprites. */
  animClass?: string;
}

export const DECORATIONS: Record<DecorationKind, DecorationDef> = {
  bush: {
    label: "Bush",
    src: "/decorations/bush.png",
    frameW: 128,
    frameH: 128,
    frames: 8,
    terrain: "land",
    animClass: "deco-bush",
  },
  rock: {
    label: "Rock",
    src: "/decorations/rock.png",
    frameW: 64,
    frameH: 64,
    frames: 1,
    terrain: "land",
    // Single static frame; no animation class.
  },
  tree: {
    label: "Tree",
    src: "/decorations/tree.png",
    frameW: 192,
    frameH: 256,
    frames: 8,
    terrain: "land",
    animClass: "deco-tree",
  },
  water_rock: {
    label: "Water rock",
    src: "/decorations/water-rock.png",
    frameW: 64,
    frameH: 64,
    frames: 16,
    terrain: "water",
    animClass: "deco-water-rock",
  },
  duck: {
    label: "Duck",
    src: "/decorations/duck.png",
    frameW: 32,
    frameH: 32,
    frames: 3,
    terrain: "water",
    animClass: "deco-duck",
  },
};

export const DECORATION_KINDS: DecorationKind[] = [
  "bush",
  "rock",
  "tree",
  "water_rock",
  "duck",
];

/** "x,y" → DecorationKind. Sparse — cells with no decoration aren't keys. */
export type DecorationsMap = Record<string, DecorationKind>;

export function decorationKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Returns true when the decoration's terrain requirement matches the
 * cell's actual state. `cellHasGrass=true` means the cell is land.
 */
export function isPlacementValid(kind: DecorationKind, cellHasGrass: boolean): boolean {
  return DECORATIONS[kind].terrain === (cellHasGrass ? "land" : "water");
}
