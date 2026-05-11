/**
 * Decoration catalog for the office scene. Each entry defines:
 *   - which terrain it can be placed on (land = grass cell, water = empty)
 *   - the source sprite sheet
 *   - native frame size (one frame of the sheet)
 *   - frame count (1 = static, >1 = uses an animation class)
 *   - CSS class that drives the per-frame animation
 *   - which category it lives in (used by the build toolbar to group
 *     buttons; doesn't affect placement)
 *
 * Decorations render at native frame size, anchored at the BOTTOM-CENTRE
 * of their grid cell. Tall sprites (trees, houses, towers) extend upward
 * into adjacent cells visually but only occupy the one cell logically.
 *
 * Adding a new decoration: drop the PNG in /apps/web/public/decorations/,
 * add an entry below, and (if it animates) a matching .deco-NAME class
 * in globals.css. The toolbar picks it up automatically from
 * DECORATION_KINDS.
 */

export type Terrain = "land" | "water";
export type DecoCategory = "land" | "buildings" | "water";

/**
 * Logical group a decoration belongs to. Each cell may hold at most one
 * decoration per family — so 4 bush variants share family "bush", and
 * placing bush2 on a cell that already has bush1 replaces it.
 * Different-family decorations stack freely (bush + tree + rock all in
 * the same cell is fine).
 */
export type DecoFamily =
  | "bush"
  | "rock"
  | "tree"
  | "stump"
  | "house"
  | "tower"
  | "castle"
  | "water_rock"
  | "duck";

export type DecorationKind =
  | "bush"
  | "bush2"
  | "bush3"
  | "bush4"
  | "rock"
  | "rock2"
  | "rock3"
  | "rock4"
  | "stump1"
  | "stump2"
  | "stump3"
  | "stump4"
  | "tree"
  | "tree2"
  | "tree3"
  | "tree4"
  | "house1"
  | "house2"
  | "house3"
  | "tower"
  | "castle"
  | "water_rock"
  | "water_rock2"
  | "water_rock3"
  | "water_rock4"
  | "duck";

export interface DecorationDef {
  label: string;
  src: string;
  frameW: number;
  frameH: number;
  frames: number;
  terrain: Terrain;
  category: DecoCategory;
  /** Placement uniqueness key — at most one decoration of each family
   *  may occupy a cell. Variants of the same kind (bush1..bush4) share
   *  a family so e.g. bush2 replaces bush1 at the same cell rather than
   *  stacking two bushes. */
  family: DecoFamily;
  animClass?: string;
}

export const DECORATIONS: Record<DecorationKind, DecorationDef> = {
  // ─ Bushes (8 frames × 128×128, animated pulse) ──────────────────────
  bush: {
    label: "Bush 1",
    src: "/decorations/bush.png",
    frameW: 128, frameH: 128, frames: 8,
    terrain: "land", category: "land", family: "bush", animClass: "deco-bush",
  },
  bush2: {
    label: "Bush 2",
    src: "/decorations/bush2.png",
    frameW: 128, frameH: 128, frames: 8,
    terrain: "land", category: "land", family: "bush", animClass: "deco-bush",
  },
  bush3: {
    label: "Bush 3",
    src: "/decorations/bush3.png",
    frameW: 128, frameH: 128, frames: 8,
    terrain: "land", category: "land", family: "bush", animClass: "deco-bush",
  },
  bush4: {
    label: "Bush 4",
    src: "/decorations/bush4.png",
    frameW: 128, frameH: 128, frames: 8,
    terrain: "land", category: "land", family: "bush", animClass: "deco-bush",
  },

  // ─ Rocks (static, 64×64) — overlays, coexist with anything ─────────
  rock: {
    label: "Rock 1",
    src: "/decorations/rock.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "rock",
  },
  rock2: {
    label: "Rock 2",
    src: "/decorations/rock2.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "rock",
  },
  rock3: {
    label: "Rock 3",
    src: "/decorations/rock3.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "rock",
  },
  rock4: {
    label: "Rock 4",
    src: "/decorations/rock4.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "rock",
  },

  // ─ Stumps (static, 192×256) ─────────────────────────────────────────
  stump1: {
    label: "Stump 1",
    src: "/decorations/stump1.png",
    frameW: 192, frameH: 256, frames: 1,
    terrain: "land", category: "land", family: "stump",
  },
  stump2: {
    label: "Stump 2",
    src: "/decorations/stump2.png",
    frameW: 192, frameH: 256, frames: 1,
    terrain: "land", category: "land", family: "stump",
  },
  stump3: {
    label: "Stump 3",
    src: "/decorations/stump3.png",
    frameW: 192, frameH: 256, frames: 1,
    terrain: "land", category: "land", family: "stump",
  },
  stump4: {
    label: "Stump 4",
    src: "/decorations/stump4.png",
    frameW: 192, frameH: 256, frames: 1,
    terrain: "land", category: "land", family: "stump",
  },

  // ─ Trees (8 frames, animated sway). Tree1/Tree2 are taller (192×256
  //   per frame); Tree3/Tree4 are shorter (192×192). All share the
  //   .deco-tree keyframe — same 8-frame stride at 192 wide each. ─────
  tree: {
    label: "Tree 1",
    src: "/decorations/tree.png",
    frameW: 192, frameH: 256, frames: 8,
    terrain: "land", category: "land", family: "tree", animClass: "deco-tree",
  },
  tree2: {
    label: "Tree 2",
    src: "/decorations/tree2.png",
    frameW: 192, frameH: 256, frames: 8,
    terrain: "land", category: "land", family: "tree", animClass: "deco-tree",
  },
  tree3: {
    label: "Tree 3",
    src: "/decorations/tree3.png",
    frameW: 192, frameH: 192, frames: 8,
    terrain: "land", category: "land", family: "tree", animClass: "deco-tree",
  },
  tree4: {
    label: "Tree 4",
    src: "/decorations/tree4.png",
    frameW: 192, frameH: 192, frames: 8,
    terrain: "land", category: "land", family: "tree", animClass: "deco-tree",
  },

  // ─ Buildings (static). Houses are 128×192; tower 128×256; castle
  //   320×256 (footprint of a small fortress). All anchor at the
  //   bottom-centre of a single cell — tall buildings extend upward. ──
  house1: {
    label: "House 1",
    src: "/decorations/house1.png",
    frameW: 128, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house",
  },
  house2: {
    label: "House 2",
    src: "/decorations/house2.png",
    frameW: 128, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house",
  },
  house3: {
    label: "House 3",
    src: "/decorations/house3.png",
    frameW: 128, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house",
  },
  tower: {
    label: "Tower",
    src: "/decorations/tower.png",
    frameW: 128, frameH: 256, frames: 1,
    terrain: "land", category: "buildings", family: "tower",
  },
  castle: {
    label: "Castle",
    src: "/decorations/castle.png",
    frameW: 320, frameH: 256, frames: 1,
    terrain: "land", category: "buildings", family: "castle",
  },

  // ─ Water rocks (16 frames × 64×64, bobs in time with foam) ─────────
  water_rock: {
    label: "Water rock 1",
    src: "/decorations/water-rock.png",
    frameW: 64, frameH: 64, frames: 16,
    terrain: "water", category: "water", family: "water_rock", animClass: "deco-water-rock",
  },
  water_rock2: {
    label: "Water rock 2",
    src: "/decorations/water-rock2.png",
    frameW: 64, frameH: 64, frames: 16,
    terrain: "water", category: "water", family: "water_rock", animClass: "deco-water-rock",
  },
  water_rock3: {
    label: "Water rock 3",
    src: "/decorations/water-rock3.png",
    frameW: 64, frameH: 64, frames: 16,
    terrain: "water", category: "water", family: "water_rock", animClass: "deco-water-rock",
  },
  water_rock4: {
    label: "Water rock 4",
    src: "/decorations/water-rock4.png",
    frameW: 64, frameH: 64, frames: 16,
    terrain: "water", category: "water", family: "water_rock", animClass: "deco-water-rock",
  },

  // ─ Duck (3 frames × 32×32, quick wobble) ────────────────────────────
  duck: {
    label: "Duck",
    src: "/decorations/duck.png",
    frameW: 32, frameH: 32, frames: 3,
    terrain: "water", category: "water", family: "duck", animClass: "deco-duck",
  },
};

export const DECORATION_KINDS: DecorationKind[] = Object.keys(DECORATIONS) as DecorationKind[];

/**
 * "x,y" → ordered list of decorations stacked at that cell. The list is
 * read back-to-front: earlier entries render below later entries. By
 * convention placement keeps solids before overlays, so a tree's leaves
 * draw under any bushes/rocks placed at the same cell.
 *
 * Sparse — cells with no decoration aren't keys (empty arrays are
 * cleaned up on erase so the map size stays minimal).
 */
export type DecorationsMap = Record<string, DecorationKind[]>;

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

export function familyOf(kind: DecorationKind): DecoFamily {
  return DECORATIONS[kind].family;
}

/**
 * Apply a single placement to a cell's stack, returning the new stack.
 *
 *   - If the cell already has a decoration of the same family, replace
 *     it in-place (preserves stack order).
 *   - Otherwise append to the end.
 *   - Exact-same-kind placement is a no-op (the returned stack is the
 *     same reference as `existing`).
 *
 * `existing` may be undefined for empty cells.
 */
export function applyPlacement(
  existing: DecorationKind[] | undefined,
  next: DecorationKind,
): DecorationKind[] {
  if (!existing || existing.length === 0) return [next];
  const family = familyOf(next);
  const idx = existing.findIndex((k) => familyOf(k) === family);
  if (idx === -1) return [...existing, next];
  if (existing[idx] === next) return existing; // no-op — already exactly that
  const out = [...existing];
  out[idx] = next;
  return out;
}

/**
 * Remove the topmost decoration from a cell's stack — last-in-first-out.
 * Returns the new stack (possibly empty) and the removed kind, or null
 * if nothing was there.
 */
export function popDecoration(
  existing: DecorationKind[] | undefined,
): { stack: DecorationKind[]; removed: DecorationKind } | null {
  if (!existing || existing.length === 0) return null;
  const stack = [...existing];
  const removed = stack.pop()!;
  return { stack, removed };
}
