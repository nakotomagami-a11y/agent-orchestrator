"use client";

import { cn } from "@/lib/cn";
import { UNIT_FACTIONS, UNIT_KINDS, type UnitSelection } from "./unit-sprite.utils";

function slotFor(unit: UnitSelection): number {
  const fi = UNIT_FACTIONS.indexOf(unit.faction);
  const ki = UNIT_KINDS.indexOf(unit.kind);
  if (fi === -1 || ki === -1) return 1;
  return fi * UNIT_KINDS.length + ki + 1;
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
      className={cn("agent-avatar shrink-0 [image-rendering:pixelated] rounded object-cover", className)}
      style={{
        width: size,
        height: size,
      }}
      alt=""
      {...ariaProps}
    />
  );
}
