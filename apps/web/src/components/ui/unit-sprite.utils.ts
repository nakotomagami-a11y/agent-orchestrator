// Catalog + resolver for the Tiny Swords unit sprite avatars.
//
// Each sprite sheet is a horizontal strip of square frames; idle and run sheets
// live under `/units/<faction>/<kind>-<state>.png`. The `bbox` describes where
// the character actually sits inside each frame so the UnitSprite can crop the
// transparent padding away and fill the avatar with the character body.
//
// Numbers come from inspection of the original assets — the Tiny Swords pack
// (Free Pack by Pixel Frog) is the source of truth.

export const UNIT_FACTIONS = ["blue", "red", "purple", "yellow", "black"] as const;
export type UnitFaction = (typeof UNIT_FACTIONS)[number];

export const UNIT_KINDS = ["pawn", "warrior", "archer", "monk", "lancer"] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

export interface UnitSelection {
  faction: UnitFaction;
  kind: UnitKind;
}

interface SheetSpec {
  frames: number;
}

interface UnitDef {
  /** Native pixel width of a single frame in the sheet. */
  frameW: number;
  /** Native pixel height of a single frame. */
  frameH: number;
  idle: SheetSpec;
  run: SheetSpec;
  /**
   * Character bounding box inside one frame, in native sprite pixels. We crop
   * to this region so the avatar shows the character, not the empty padding
   * the engine uses for attacks/projectiles.
   */
  bbox: { x: number; y: number; w: number; h: number };
  /** Human-readable name shown in the unit picker. */
  label: string;
}

export const UNIT_DEFS: Record<UnitKind, UnitDef> = {
  pawn: {
    frameW: 192,
    frameH: 192,
    idle: { frames: 8 },
    run: { frames: 6 },
    bbox: { x: 64, y: 60, w: 64, h: 104 },
    label: "Pawn",
  },
  warrior: {
    frameW: 192,
    frameH: 192,
    idle: { frames: 8 },
    run: { frames: 6 },
    bbox: { x: 56, y: 56, w: 80, h: 112 },
    label: "Warrior",
  },
  archer: {
    frameW: 192,
    frameH: 192,
    idle: { frames: 6 },
    run: { frames: 4 },
    bbox: { x: 56, y: 56, w: 80, h: 112 },
    label: "Archer",
  },
  monk: {
    frameW: 192,
    frameH: 192,
    idle: { frames: 6 },
    run: { frames: 4 },
    bbox: { x: 56, y: 56, w: 80, h: 112 },
    label: "Monk",
  },
  lancer: {
    frameW: 320,
    frameH: 320,
    idle: { frames: 12 },
    run: { frames: 6 },
    bbox: { x: 96, y: 24, w: 128, h: 272 },
    label: "Lancer",
  },
};

export const FACTION_LABELS: Record<UnitFaction, string> = {
  blue: "Blue",
  red: "Red",
  purple: "Purple",
  yellow: "Yellow",
  black: "Black",
};

export function isUnitFaction(value: string): value is UnitFaction {
  return (UNIT_FACTIONS as readonly string[]).includes(value);
}

export function isUnitKind(value: string): value is UnitKind {
  return (UNIT_KINDS as readonly string[]).includes(value);
}

/** Parse `"blue/pawn"` into a {@link UnitSelection}. Returns `null` if invalid. */
export function parseUnit(raw: string | null | undefined): UnitSelection | null {
  if (!raw) return null;
  const parts = raw.trim().toLowerCase().split("/");
  if (parts.length !== 2) return null;
  const [faction, kind] = parts;
  if (!faction || !kind) return null;
  if (!isUnitFaction(faction) || !isUnitKind(kind)) return null;
  return { faction, kind };
}

export function formatUnit(u: UnitSelection): string {
  return `${u.faction}/${u.kind}`;
}

export function unitSheetSrc(
  faction: UnitFaction,
  kind: UnitKind,
  state: "idle" | "run",
): string {
  return `/units/${faction}/${kind}-${state}.png`;
}

/**
 * Default unit selection for every agent. Per the latest design call,
 * we no longer randomise (or accept frontmatter overrides for) per-agent
 * faction/kind — everyone is the black-faction pawn. Both arguments are
 * kept on the signature so existing callsites compile without a rewrite;
 * they're intentionally ignored. The function still returns a value for
 * the same reason — easier to remove later if we re-enable variants
 * than to inline the constant everywhere.
 */
export function unitForAgent(_name: string, _override?: string | null): UnitSelection {
  return { faction: "black", kind: "pawn" };
}
