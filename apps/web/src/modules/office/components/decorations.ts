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
 * decoration per family - so 4 bush variants share family "bush", and
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
  | "archery"
  | "barracks"
  | "monastery"
  | "campfire"
  | "water_rock"
  | "duck"
  | "butterfly"
  | "mushroom"
  | "shrub"
  | "pumpkin"
  | "bones"
  | "sign"
  | "grave"
  | "scarecrow"
  | "sheep"
  | "pig"
  | "gold_mine"
  | "cursed_chest"
  | "bridge"
  | "path";

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
  | "house"
  | "house4"
  | "house5"
  | "house6"
  | "house7"
  | "house8"
  | "house_blue"
  | "house_purple"
  | "house_red"
  | "house_yellow"
  | "house_goblin"
  | "tower"
  | "castle"
  | "archery"
  | "barracks"
  | "monastery"
  | "water_rock"
  | "water_rock2"
  | "water_rock3"
  | "water_rock4"
  | "duck"
  | "mushroom1"
  | "mushroom2"
  | "mushroom3"
  | "shrub1"
  | "shrub2"
  | "shrub3"
  | "shrub4"
  | "shrub5"
  | "pumpkin1"
  | "pumpkin2"
  | "bones1"
  | "bones2"
  | "bone_sign"
  | "gravestone"
  | "scarecrow"
  | "sheep"
  | "pig"
  | "gold_mine_active"
  | "gold_mine_inactive"
  | "gold_mine_destroyed"
  | "cursed_chest"
  | "bridge_h"
  | "bridge_v"
  // ── Campfire ─────────────────────────────────────────────────────────────
  | "campfire"
  // ── Butterflies ──────────────────────────────────────────────────────────
  | "butterfly_blue"
  | "butterfly_grey"
  | "butterfly_pink"
  | "butterfly_red"
  | "butterfly_white"
  | "butterfly_yellow"
  | "path";

export interface DecorationDef {
  label: string;
  src: string;
  frameW: number;
  frameH: number;
  frames: number;
  terrain: Terrain;
  category: DecoCategory;
  /** Placement uniqueness key - at most one decoration of each family
   *  may occupy a cell. Variants of the same kind (bush1..bush4) share
   *  a family so e.g. bush2 replaces bush1 at the same cell rather than
   *  stacking two bushes. */
  family: DecoFamily;
  animClass?: string;
  /** How the sprite is positioned inside its owning cell.
   *
   *   - "bottom" (default): the sprite's bottom-centre aligns with the
   *     cell's bottom-centre. Tall sprites (trees, houses, towers) hang
   *     upward from the cell - they look rooted to the ground.
   *   - "center": the sprite's centre aligns with the cell's centre.
   *     Used for free-standing creatures (sheep) so they read as
   *     standing on the tile rather than hanging from its top edge.
   */
  anchor?: "bottom" | "center";
  /** For 2D tilesheets (not horizontal strips): total sheet pixel width. */
  sheetW?: number;
  /** For 2D tilesheets: total sheet pixel height. */
  sheetH?: number;
  /** Preview tile column index within a 2D tilesheet. */
  previewCol?: number;
  /** Preview tile row index within a 2D tilesheet. */
  previewRow?: number;
  /** Shown in the build palette but greyed out and unselectable. Used for
   *  assets that aren't style-matched/finished yet. */
  locked?: boolean;
  /** Alternate sprites for discrete rotation. Index = DecoInstance.rot (0/1/2);
   *  index 0 should equal `src`. Enables the free-hand rotate control. */
  rotFrames?: string[];
  /** When true, the building has faction-colour variants. Blue is the base
   *  sprite (`src`/`rotFrames`); other colours resolve to `<name>_<color>.png`
   *  via {@link decoSrc}. Enables the colour swatches in the select menu. */
  colorable?: boolean;
}

export const DECORATIONS: Record<DecorationKind, DecorationDef> = {
  // ─ Bushes (8 frames × 128×128, animated pulse) ──────────────────────
  bush: {
    label: "Bush 1",
    src: "/decorations/bush.png",
    frameW: 128, frameH: 128, frames: 8,
    terrain: "land", category: "land", family: "bush", animClass: "animate-[deco-bush_1.6s_steps(8)_infinite]",
  },
  bush2: {
    label: "Bush 2",
    src: "/decorations/bush2.png",
    frameW: 128, frameH: 128, frames: 8,
    terrain: "land", category: "land", family: "bush", animClass: "animate-[deco-bush_1.6s_steps(8)_infinite]",
  },
  bush3: {
    label: "Bush 3",
    src: "/decorations/bush3.png",
    frameW: 128, frameH: 128, frames: 8,
    terrain: "land", category: "land", family: "bush", animClass: "animate-[deco-bush_1.6s_steps(8)_infinite]",
  },
  bush4: {
    label: "Bush 4",
    src: "/decorations/bush4.png",
    frameW: 128, frameH: 128, frames: 8,
    terrain: "land", category: "land", family: "bush", animClass: "animate-[deco-bush_1.6s_steps(8)_infinite]",
  },

  // ─ Rocks (static, 64×64) - overlays, coexist with anything ─────────
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
  //   .deco-tree keyframe - same 8-frame stride at 192 wide each. ─────
  tree: {
    label: "Tree 1",
    src: "/decorations/tree.png",
    frameW: 192, frameH: 256, frames: 8,
    terrain: "land", category: "land", family: "tree", animClass: "animate-[deco-tree_2.4s_steps(8)_infinite]",
  },
  tree2: {
    label: "Tree 2",
    src: "/decorations/tree2.png",
    frameW: 192, frameH: 256, frames: 8,
    terrain: "land", category: "land", family: "tree", animClass: "animate-[deco-tree_2.4s_steps(8)_infinite]",
  },
  tree3: {
    label: "Tree 3",
    src: "/decorations/tree3.png",
    frameW: 192, frameH: 192, frames: 8,
    terrain: "land", category: "land", family: "tree", animClass: "animate-[deco-tree_2.4s_steps(8)_infinite]",
  },
  tree4: {
    label: "Tree 4",
    src: "/decorations/tree4.png",
    frameW: 192, frameH: 192, frames: 8,
    terrain: "land", category: "land", family: "tree", animClass: "animate-[deco-tree_2.4s_steps(8)_infinite]",
  },

  // ─ Buildings (static). Houses are 128×192; tower 128×256; castle
  //   320×256 (footprint of a small fortress). All anchor at the
  //   bottom-centre of a single cell - tall buildings extend upward. ──
  // House 1-3 are the same building at 3 angles — merged into one rotatable
  // "house". rot (0/1/2) picks the frame; the free-hand tool rotates + mirrors.
  house: {
    label: "House",
    src: "/decorations/house1.png",
    frameW: 128, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house", colorable: true,
    rotFrames: ["/decorations/house1.png", "/decorations/house2.png", "/decorations/house3.png"],
  },
  // House 4-8: 5 new AI-generated houses (dropped in 2026-07-25). Native art
  // was much higher-res/detailed than the Tiny Swords set (1024×1024ish
  // square renders vs the pack's flat 128×192 sprites) - auto-cropped to
  // their opaque bbox and downscaled to ~192px tall (house1-3's height) as a
  // functional first pass. Style-match and per-sprite anchor/scale tuning
  // is a follow-up, not done here.
  house4: {
    label: "House 4",
    src: "/decorations/house4.png",
    frameW: 192, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house",
  },
  house5: {
    label: "House 5",
    src: "/decorations/house5.png",
    frameW: 182, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house",
  },
  house6: {
    label: "House 6",
    src: "/decorations/house6.png",
    frameW: 192, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house", locked: true,
  },
  house7: {
    label: "House 7",
    src: "/decorations/house7.png",
    frameW: 187, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house", locked: true,
  },
  house8: {
    label: "House 8",
    src: "/decorations/house8.png",
    frameW: 192, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house", locked: true,
  },
  // Knights House - 4 faction colour variants from the Update 010 pack.
  house_blue: {
    label: "House (Blue)",
    src: "/decorations/house_blue.png",
    frameW: 128, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house",
  },
  house_purple: {
    label: "House (Purple)",
    src: "/decorations/house_purple.png",
    frameW: 128, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house",
  },
  house_red: {
    label: "House (Red)",
    src: "/decorations/house_red.png",
    frameW: 128, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house",
  },
  house_yellow: {
    label: "House (Yellow)",
    src: "/decorations/house_yellow.png",
    frameW: 128, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house",
  },
  // Goblin Wood House - the only Goblin house variant in the pack.
  house_goblin: {
    label: "Goblin House",
    src: "/decorations/house_goblin.png",
    frameW: 128, frameH: 192, frames: 1,
    terrain: "land", category: "buildings", family: "house",
  },
  // Gold Mine - three states from the Update 010 Resources/Gold Mine
  // folder. All 192×128 static frames anchored at bottom-centre (the
  // sprite spans ~3 cells wide and ~2 cells tall visually). Single
  // "gold_mine" family so a cell only ever shows one state at a time -
  // switching between active/inactive/destroyed swaps the sprite in
  // place.
  gold_mine_active: {
    label: "Gold mine (active)",
    src: "/decorations/gold_mine_active.png",
    frameW: 192, frameH: 128, frames: 1,
    terrain: "land", category: "buildings", family: "gold_mine",
  },
  gold_mine_inactive: {
    label: "Gold mine (inactive)",
    src: "/decorations/gold_mine_inactive.png",
    frameW: 192, frameH: 128, frames: 1,
    terrain: "land", category: "buildings", family: "gold_mine",
  },
  gold_mine_destroyed: {
    label: "Gold mine (destroyed)",
    src: "/decorations/gold_mine_destroyed.png",
    frameW: 192, frameH: 128, frames: 1,
    terrain: "land", category: "buildings", family: "gold_mine",
  },
  // Cursed chest - animated 6×64×64. Treated as a "building" so it
  // sits in the same toolbar group as houses and the mine.
  cursed_chest: {
    label: "Cursed chest",
    src: "/decorations/cursed_chest.png",
    frameW: 64, frameH: 64, frames: 6,
    terrain: "land", category: "buildings", family: "cursed_chest",
    animClass: "animate-[deco-cursed-chest_1.8s_steps(6)_infinite]",
  },
  tower: {
    label: "Tower",
    src: "/decorations/tower.png",
    frameW: 128, frameH: 256, frames: 1,
    terrain: "land", category: "buildings", family: "tower", colorable: true,
  },
  castle: {
    label: "Castle",
    src: "/decorations/castle.png",
    frameW: 320, frameH: 256, frames: 1,
    terrain: "land", category: "buildings", family: "castle", colorable: true,
  },
  // Archery, Barracks, Monastery — the remaining Tiny Swords building types.
  // Blue is the base sprite; red/purple/yellow/black resolve via decoSrc().
  archery: {
    label: "Archery",
    src: "/decorations/archery.png",
    frameW: 192, frameH: 256, frames: 1,
    terrain: "land", category: "buildings", family: "archery", colorable: true,
  },
  barracks: {
    label: "Barracks",
    src: "/decorations/barracks.png",
    frameW: 192, frameH: 256, frames: 1,
    terrain: "land", category: "buildings", family: "barracks", colorable: true,
  },
  monastery: {
    label: "Monastery",
    src: "/decorations/monastery.png",
    frameW: 192, frameH: 320, frames: 1,
    terrain: "land", category: "buildings", family: "monastery", colorable: true,
  },

  // ─ Water rocks (16 frames × 64×64, bobs in time with foam) ─────────
  water_rock: {
    label: "Water rock 1",
    src: "/decorations/water-rock.png",
    frameW: 64, frameH: 64, frames: 16,
    terrain: "water", category: "water", family: "water_rock", animClass: "animate-[deco-water-rock_1.6s_steps(16)_infinite]",
  },
  water_rock2: {
    label: "Water rock 2",
    src: "/decorations/water-rock2.png",
    frameW: 64, frameH: 64, frames: 16,
    terrain: "water", category: "water", family: "water_rock", animClass: "animate-[deco-water-rock_1.6s_steps(16)_infinite]",
  },
  water_rock3: {
    label: "Water rock 3",
    src: "/decorations/water-rock3.png",
    frameW: 64, frameH: 64, frames: 16,
    terrain: "water", category: "water", family: "water_rock", animClass: "animate-[deco-water-rock_1.6s_steps(16)_infinite]",
  },
  water_rock4: {
    label: "Water rock 4",
    src: "/decorations/water-rock4.png",
    frameW: 64, frameH: 64, frames: 16,
    terrain: "water", category: "water", family: "water_rock", animClass: "animate-[deco-water-rock_1.6s_steps(16)_infinite]",
  },

  // ─ Duck (3 frames × 32×32, quick wobble) ────────────────────────────
  duck: {
    label: "Duck",
    src: "/decorations/duck.png",
    frameW: 32, frameH: 32, frames: 3,
    terrain: "water", category: "water", family: "duck", animClass: "animate-[deco-duck_0.6s_steps(3)_infinite]",
  },

  // ─ Mushrooms (static 64×64, three sizes) ────────────────────────────
  mushroom1: {
    label: "Mushroom (small)",
    src: "/decorations/mushroom1.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "mushroom",
  },
  mushroom2: {
    label: "Mushroom (medium)",
    src: "/decorations/mushroom2.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "mushroom",
  },
  mushroom3: {
    label: "Mushroom (large)",
    src: "/decorations/mushroom3.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "mushroom",
  },

  // ─ Shrubs / dark foliage (static 64×64) ─────────────────────────────
  shrub1: {
    label: "Shrub 1",
    src: "/decorations/shrub1.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "shrub",
  },
  shrub2: {
    label: "Shrub 2",
    src: "/decorations/shrub2.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "shrub",
  },
  shrub3: {
    label: "Shrub 3",
    src: "/decorations/shrub3.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "shrub",
  },
  shrub4: {
    label: "Shrub 4",
    src: "/decorations/shrub4.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "shrub",
  },
  shrub5: {
    label: "Shrub 5",
    src: "/decorations/shrub5.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "shrub",
  },

  // ─ Pumpkins (static 64×64) ──────────────────────────────────────────
  pumpkin1: {
    label: "Pumpkin (small)",
    src: "/decorations/pumpkin1.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "pumpkin",
  },
  pumpkin2: {
    label: "Pumpkin (large)",
    src: "/decorations/pumpkin2.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "pumpkin",
  },

  // ─ Bones (static 64×64) ─────────────────────────────────────────────
  bones1: {
    label: "Bones 1",
    src: "/decorations/bones1.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "bones",
  },
  bones2: {
    label: "Bones 2",
    src: "/decorations/bones2.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "bones",
  },

  // ─ Tall props (64×128, extend upward into the cell above) ───────────
  bone_sign: {
    label: "Bone sign",
    src: "/decorations/bone-sign.png",
    frameW: 64, frameH: 128, frames: 1,
    terrain: "land", category: "land", family: "sign",
  },
  gravestone: {
    label: "Gravestone",
    src: "/decorations/gravestone.png",
    frameW: 64, frameH: 128, frames: 1,
    terrain: "land", category: "land", family: "grave",
  },

  // ─ Scarecrow (large 192×192, spans 3×3 visually) ────────────────────
  scarecrow: {
    label: "Scarecrow",
    src: "/decorations/scarecrow.png",
    frameW: 192, frameH: 192, frames: 1,
    terrain: "land", category: "land", family: "scarecrow",
  },

  // ─ Sheep (animated, 8 × 128×128). Reuses the deco-bush keyframe
  //   since both sheets have identical 1024×128 stride. Agents standing
  //   on a sheep tile while working switch to the knife animation
  //   (sheep-shearing pose) - see OfficeMap. ───────────────────────────
  sheep: {
    label: "Sheep",
    src: "/decorations/sheep.png",
    frameW: 128, frameH: 128, frames: 8,
    terrain: "land", category: "land", family: "sheep", animClass: "animate-[deco-bush_1.6s_steps(8)_infinite]",
    anchor: "center",
  },

  // ─ Pig (animated, 8 × 128×128). Same 1024×128 stride as the sheep so it
  //   reuses the deco-bush keyframe and centres on its tile. ───────────────
  pig: {
    label: "Pig",
    src: "/decorations/pig.png",
    frameW: 128, frameH: 128, frames: 8,
    terrain: "land", category: "land", family: "pig", animClass: "animate-[deco-bush_1.6s_steps(8)_infinite]",
    anchor: "center",
  },

  // ─ Campfire (8 frames × 32×64, animated flicker). The sheet has 8
  //   flame poses at 32px stride in a 256×64 image. Centred in the cell
  //   via the (TILE - frameW) / 2 horizontal offset in OfficeMap. ──────
  campfire: {
    label: "Campfire",
    src: "/decorations/campfire.png",
    frameW: 32, frameH: 64, frames: 8,
    terrain: "land", category: "land", family: "campfire", animClass: "animate-[deco-campfire_0.64s_steps(8)_infinite]",
  },

  // ─ Butterflies (5 frames × 16×16, animated flutter). Six colour
  //   variants share the "butterfly" family - only one may occupy a
  //   cell at a time, matching the sheep/duck behaviour. Centred so
  //   they appear to hover over the tile rather than hang from its
  //   top edge. ──────────────────────────────────────────────────────
  butterfly_blue: {
    label: "Butterfly (blue)",
    src: "/decorations/butterfly_blue.png",
    frameW: 16, frameH: 16, frames: 5,
    terrain: "land", category: "land", family: "butterfly", animClass: "animate-[deco-butterfly_0.7s_steps(5)_infinite]",
    anchor: "center",
  },
  butterfly_grey: {
    label: "Butterfly (grey)",
    src: "/decorations/butterfly_grey.png",
    frameW: 16, frameH: 16, frames: 5,
    terrain: "land", category: "land", family: "butterfly", animClass: "animate-[deco-butterfly_0.7s_steps(5)_infinite]",
    anchor: "center",
  },
  butterfly_pink: {
    label: "Butterfly (pink)",
    src: "/decorations/butterfly_pink.png",
    frameW: 16, frameH: 16, frames: 5,
    terrain: "land", category: "land", family: "butterfly", animClass: "animate-[deco-butterfly_0.7s_steps(5)_infinite]",
    anchor: "center",
  },
  butterfly_red: {
    label: "Butterfly (red)",
    src: "/decorations/butterfly_red.png",
    frameW: 16, frameH: 16, frames: 5,
    terrain: "land", category: "land", family: "butterfly", animClass: "animate-[deco-butterfly_0.7s_steps(5)_infinite]",
    anchor: "center",
  },
  butterfly_white: {
    label: "Butterfly (white)",
    src: "/decorations/butterfly_white.png",
    frameW: 16, frameH: 16, frames: 5,
    terrain: "land", category: "land", family: "butterfly", animClass: "animate-[deco-butterfly_0.7s_steps(5)_infinite]",
    anchor: "center",
  },
  butterfly_yellow: {
    label: "Butterfly (yellow)",
    src: "/decorations/butterfly_yellow.png",
    frameW: 16, frameH: 16, frames: 5,
    terrain: "land", category: "land", family: "butterfly", animClass: "animate-[deco-butterfly_0.7s_steps(5)_infinite]",
    anchor: "center",
  },

  // ─ Path (64×64 per tile, land-only). Auto-tile: the renderer picks the
  //   correct tile from the 4×4 sheet (path.png) based on which of the 4
  //   cardinal neighbours also carry a "path" decoration. Single "path"
  //   family so at most one path tile occupies a cell at a time. The
  //   sheetW/sheetH/previewCol/previewRow fields tell DecoSprite to show
  //   the cross tile (col 3, row 3) as the toolbar thumbnail. ──────────
  path: {
    label: "Path",
    src: "/tiles/path.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "land", category: "land", family: "path",
    sheetW: 256, sheetH: 256, // full sheet size; previewCol/Row=0 → isolated tile at (0,0)
    locked: true, // path building not style-finished yet — disabled for sharing
  },

  // ─ Bridges (static 64×64, water-only). Only the middle plank is
  //   player-placeable - the matching end caps are painted
  //   automatically by OfficeMap onto neighbouring land cells, so the
  //   bridge always meets land cleanly without forcing the user to
  //   place caps manually. Single "bridge" family per cell. ────────────
  bridge_h: {
    label: "Bridge - horizontal",
    src: "/decorations/bridge-h-m.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "water", category: "water", family: "bridge",
  },
  bridge_v: {
    label: "Bridge - vertical",
    src: "/decorations/bridge-v-m.png",
    frameW: 64, frameH: 64, frames: 1,
    terrain: "water", category: "water", family: "bridge",
  },
};

/**
 * Auto-rendered bridge end-cap sprites. These are NOT placeable
 * decorations - OfficeMap paints them on land cells that touch a
 * placed `bridge_h` / `bridge_v` middle tile, so the bridge always
 * "lands" with a proper end-piece without the user having to manage
 * caps in the build palette.
 *
 * Each entry is a 64×64 PNG; the sprite art already has transparent
 * padding on the side that connects to the bridge middle (left half
 * for the LEFT cap, right half for the RIGHT cap, etc.), so painting
 * the full tile on top of a land cell only covers the half that
 * meets the bridge.
 */
export const BRIDGE_CAPS = {
  h_l: { src: "/decorations/bridge-h-l.png", frameW: 64, frameH: 64 },
  h_r: { src: "/decorations/bridge-h-r.png", frameW: 64, frameH: 64 },
  v_t: { src: "/decorations/bridge-v-t.png", frameW: 64, frameH: 64 },
  v_b: { src: "/decorations/bridge-v-b.png", frameW: 64, frameH: 64 },
} as const;

export const DECORATION_KINDS: DecorationKind[] = Object.keys(DECORATIONS) as DecorationKind[];

/**
 * "x,y" → ordered list of decorations stacked at that cell. The list is
 * read back-to-front: earlier entries render below later entries. By
 * convention placement keeps solids before overlays, so a tree's leaves
 * draw under any bushes/rocks placed at the same cell.
 *
 * Sparse - cells with no decoration aren't keys (empty arrays are
 * cleaned up on erase so the map size stays minimal).
 */
/**
 * A single placed decoration instance. `kind` is the sprite; the rest are
 * per-instance edits applied by the free-hand tool:
 *   - rot:  rotation frame index (0/1/2) for kinds that declare rotation frames
 *   - flip: horizontal mirror
 *   - dx/dy: pixel offset within the cell (clamped to ±TILE at the edit site)
 * All optional → an unedited instance is just `{ kind }`.
 */
/** Faction colours for `colorable` buildings. Blue is the base sprite. */
export type BuildingColor = "blue" | "red" | "purple" | "yellow" | "black";

/** Ordered list for the colour swatches, with their display hex. */
export const BUILDING_COLORS: { id: BuildingColor; hex: string }[] = [
  { id: "blue", hex: "#4a90d9" },
  { id: "red", hex: "#d94a4a" },
  { id: "purple", hex: "#9b6bd6" },
  { id: "yellow", hex: "#e0b23c" },
  { id: "black", hex: "#3a3a42" },
];

export type DecoInstance = {
  kind: DecorationKind;
  rot?: 0 | 1 | 2;
  flip?: boolean;
  dx?: number;
  dy?: number;
  /** Faction colour for `colorable` buildings. Omitted = blue (base sprite). */
  color?: BuildingColor;
  /** Manual draw-order bias. Sprites sort by z first, then row (y), then stack
   *  position — so a higher z brings the item in front of overlapping sprites,
   *  lower sends it behind. Omitted = 0. */
  z?: number;
};

/**
 * Resolves the sprite URL for an instance, accounting for rotation frame and
 * faction colour. Blue (or no colour) uses the base sprite; other colours map
 * to `<name>_<color>.png`.
 */
export function decoSrc(def: DecorationDef, inst: DecoInstance): string {
  const base = def.rotFrames?.[inst.rot ?? 0] ?? def.src;
  if (!def.colorable || !inst.color || inst.color === "blue") return base;
  return base.replace(/\.png$/, `_${inst.color}.png`);
}

export type DecorationsMap = Record<string, DecoInstance[]>;

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
 * Props (bushes, trees, rocks, flowers, ducks, …) may be placed multiple times
 * in a single cell and spread apart with per-instance offsets. Structural kinds
 * — buildings, bridges, and paths — stay one-per-cell.
 */
export function isStackable(kind: DecorationKind): boolean {
  const def = DECORATIONS[kind];
  return def.category !== "buildings" && def.family !== "bridge" && kind !== "path";
}

/**
 * Ground footprint in tiles (`w` wide × `d` deep) for buildings that occupy
 * more than one cell. Anchored at the placement cell: centred horizontally
 * (even widths bias left) and extending `d` rows back/up. Anything not listed
 * is 1×1. Tune these per building — they're the ground the building "sits on",
 * not the full sprite width (roofs overhang).
 */
export const BUILDING_FOOTPRINTS: Partial<Record<DecorationKind, { w: number; d: number }>> = {
  house: { w: 2, d: 2 },
  house4: { w: 2, d: 2 },
  house5: { w: 2, d: 2 },
  house6: { w: 2, d: 2 },
  house7: { w: 2, d: 2 },
  house8: { w: 2, d: 2 },
  house_blue: { w: 2, d: 2 },
  house_purple: { w: 2, d: 2 },
  house_red: { w: 2, d: 2 },
  house_yellow: { w: 2, d: 2 },
  house_goblin: { w: 1, d: 2 },
  tower: { w: 1, d: 2 },
  archery: { w: 2, d: 2 },
  barracks: { w: 3, d: 2 },
  monastery: { w: 2, d: 2 },
  castle: { w: 5, d: 2 },
  gold_mine_active: { w: 3, d: 2 },
  gold_mine_inactive: { w: 3, d: 2 },
  gold_mine_destroyed: { w: 3, d: 2 },
};

/** The set of cells a decoration occupies when anchored at (x, y). */
export function footprintCells(kind: DecorationKind, x: number, y: number): [number, number][] {
  const fp = BUILDING_FOOTPRINTS[kind];
  if (!fp) return [[x, y]];
  const startX = x - Math.floor((fp.w - 1) / 2);
  const cells: [number, number][] = [];
  for (let dx = 0; dx < fp.w; dx++) {
    for (let dy = 0; dy < fp.d; dy++) cells.push([startX + dx, y - dy]);
  }
  return cells;
}

/**
 * Horizontal sprite shift (in tiles) so the sprite centres over its whole
 * footprint rather than over just the anchor cell. Even-width footprints
 * straddle a tile boundary, so their centre is ½ tile right of the anchor
 * cell's centre; odd widths (and 1×1) need no shift. Multiply by TILE and add
 * to the sprite's left in every place that positions a decoration.
 */
export function footprintCenterShift(kind: DecorationKind): number {
  const w = BUILDING_FOOTPRINTS[kind]?.w ?? 1;
  return -Math.floor((w - 1) / 2) + w / 2 - 0.5;
}

/**
 * All cells covered by a placed building's footprint, mapped back to the anchor
 * key that owns them. Used to block overlapping placement. Non-building decos
 * (props, bridges, paths) don't reserve area.
 */
export function buildingOccupancy(decorations: DecorationsMap): Map<string, string> {
  const occ = new Map<string, string>();
  for (const [key, stack] of Object.entries(decorations)) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    for (const inst of stack) {
      if (DECORATIONS[inst.kind].category !== "buildings") continue;
      for (const [cx, cy] of footprintCells(inst.kind, x, y)) occ.set(decorationKey(cx, cy), key);
    }
  }
  return occ;
}

/**
 * True when a bridge end-cap would render on cell `(x, y)`. Mirrors the
 * cap-painting logic in OfficeMap: a cap appears iff the cell is land
 * AND a neighbouring water cell holds a bridge middle that points at
 * this cell (horizontal bridge on the L/R neighbour, vertical bridge on
 * the T/B neighbour).
 *
 * Used to block decoration placement on the cap cell - once a bridge
 * uses a land tile as its anchor, that tile is reserved for the
 * bridge ramp.
 */
export function hasBridgeCap(
  x: number,
  y: number,
  grid: boolean[][],
  decorations: DecorationsMap,
): boolean {
  if (grid[y]?.[x] !== true) return false;
  const has = (cx: number, cy: number, kind: DecorationKind): boolean => {
    const stack = decorations[decorationKey(cx, cy)];
    return !!stack && stack.some((e) => e.kind === kind);
  };
  return (
    has(x - 1, y, "bridge_h") ||
    has(x + 1, y, "bridge_h") ||
    has(x, y - 1, "bridge_v") ||
    has(x, y + 1, "bridge_v")
  );
}

/**
 * Apply a single placement to a cell's stack, returning the new stack.
 *
 *   - If the cell already has a decoration of the same family, replace
 *     it in-place (preserves stack order, does not count toward cap).
 *   - If the stack is at MAX_STACK and no same-family slot exists, no-op.
 *   - Exact-same-kind is a no-op (returns same reference).
 *
 * `existing` may be undefined for empty cells.
 */
const MAX_STACK = 2;
// Stackable props can pile up in a cell (spread apart with per-instance
// offsets); higher cap keeps the map JSON bounded.
const MAX_STACK_PROPS = 12;

export function applyPlacement(
  existing: DecoInstance[] | undefined,
  next: DecorationKind,
): DecoInstance[] {
  if (!existing || existing.length === 0) return [{ kind: next }];
  // Stackable props: always add another instance (up to the prop cap) so the
  // user can place several bushes/rocks/flowers in one cell and nudge them apart.
  if (isStackable(next)) {
    if (existing.length >= MAX_STACK_PROPS) return existing;
    return [...existing, { kind: next }];
  }
  const family = familyOf(next);
  const idx = existing.findIndex((e) => familyOf(e.kind) === family);
  // Same family: replace in-place regardless of cap
  if (idx !== -1) {
    if (existing[idx]!.kind === next) return existing; // no-op
    const out = [...existing];
    out[idx] = { kind: next };
    return out;
  }
  // Different family: only append if under the cap
  if (existing.length >= MAX_STACK) return existing;
  return [...existing, { kind: next }];
}

/**
 * Remove the topmost decoration from a cell's stack - last-in-first-out.
 * Returns the new stack (possibly empty) and the removed kind, or null
 * if nothing was there.
 */
export function popDecoration(
  existing: DecoInstance[] | undefined,
): { stack: DecoInstance[]; removed: DecoInstance } | null {
  if (!existing || existing.length === 0) return null;
  const stack = [...existing];
  const removed = stack.pop()!;
  return { stack, removed };
}
