"use client";

import { cn } from "@/lib/cn";

const AVATAR_COUNT = 25;

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Stable 1-indexed avatar slot for an agent. An optional explicit override
 * (e.g. "07") wins; otherwise the agent name hashes deterministically into
 * the catalog, so the same name always renders the same avatar.
 */
function avatarSlotFor(name: string, override?: string | null): number {
  if (override) {
    const n = Number.parseInt(override, 10);
    if (Number.isFinite(n) && n >= 1 && n <= AVATAR_COUNT) return n;
  }
  return (hashString(name) % AVATAR_COUNT) + 1;
}

function avatarSrc(slot: number): string {
  return `/avatars/${slot.toString().padStart(2, "0")}.png`;
}

export type AgentAvatarProps = {
  /** Agent display name — used to deterministically pick an avatar. */
  name: string;
  /** Optional override slot (1–25 as a string). Honored if valid; else hash. */
  override?: string | null;
  /** Square size in CSS pixels. Defaults to 32. */
  size?: number;
  /** Optional accessible label. Decorative by default. */
  label?: string;
  className?: string;
};

/**
 * Static portrait-style avatar from the Tiny Swords Human Avatars set. Used
 * where we want a clean character bust (sidebar roster, chat-row labels)
 * instead of the full-body UnitSprite.
 */
export function AgentAvatar({ name, override, size = 32, label, className }: AgentAvatarProps) {
  const slot = avatarSlotFor(name, override);
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
