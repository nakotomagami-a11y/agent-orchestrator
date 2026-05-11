"use client";

import { cn } from "@/lib/cn";
import {
  UNIT_FACTIONS,
  UNIT_KINDS,
  type UnitSelection,
} from "./unit-sprite.utils";

/**
 * Map a `(faction, kind)` selection to the corresponding 1-25 portrait slot.
 *
 * The avatar set is laid out as 5 factions × 5 kinds in the same order as
 * the unit sprite catalog:
 *
 *   01-05: blue   (pawn, warrior, archer, monk, lancer)
 *   06-10: red    (same)
 *   11-15: purple
 *   16-20: yellow
 *   21-25: black
 *
 * So an agent that resolved to `yellow/archer` for its UnitSprite gets the
 * yellow/archer portrait here — the iso-office floor character and the
 * sidebar avatar stay visually consistent for the same agent.
 */
function slotFor(unit: UnitSelection): number {
  const factionIdx = UNIT_FACTIONS.indexOf(unit.faction);
  const kindIdx = UNIT_KINDS.indexOf(unit.kind);
  if (factionIdx < 0 || kindIdx < 0) return 1;
  return factionIdx * UNIT_KINDS.length + kindIdx + 1;
}

function avatarSrc(slot: number): string {
  return `/avatars/${slot.toString().padStart(2, "0")}.png`;
}

export type AgentAvatarProps = {
  /** Same unit selection used by `UnitSprite` so the avatar matches the sprite. */
  unit: UnitSelection;
  /** Square size in CSS pixels. Defaults to 32. */
  size?: number;
  /** Optional accessible label. Decorative by default. */
  label?: string;
  className?: string;
};

/**
 * Static portrait-style avatar from the Tiny Swords Human Avatars set. Picks
 * the portrait that matches the agent's chosen unit faction+kind, so the
 * sidebar bust and the office-floor full-body sprite are always the same
 * character.
 */
export function AgentAvatar({ unit, size = 32, label, className }: AgentAvatarProps) {
  const slot = slotFor(unit);
  const ariaProps = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true };
  return (
    <img
      src={avatarSrc(slot)}
      width={size}
      height={size}
      className={cn("agent-avatar", className)}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        imageRendering: "pixelated",
        borderRadius: 6,
        objectFit: "cover",
      }}
      alt=""
      {...ariaProps}
    />
  );
}
