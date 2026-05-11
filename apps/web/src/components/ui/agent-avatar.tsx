"use client";

import { cn } from "@/lib/cn";
import { type UnitSelection } from "./unit-sprite.utils";

/**
 * Currently every agent uses 10.png — the user identified this portrait
 * as the canonical "black faction pawn" bust. Kept as a function (rather
 * than inlining the constant) so re-enabling per-agent variants later
 * is a one-line change: drop the constant and recompute slot from
 * `unit.faction` / `unit.kind`.
 */
function slotFor(_unit: UnitSelection): number {
  return 10;
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
