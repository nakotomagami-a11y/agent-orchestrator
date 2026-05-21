// Deterministic sprite palette per agent. Real agents in ~/.claude/agents/
// don't ship with sprite info, so we derive skin/hair/shirt/accessory from a
// stable hash of the agent name - same agent = same look every render.

import type { SpriteAgent } from "@/components/ui/pixel-sprite.utils";

const SKINS = ["#F5C68C", "#E3A684", "#C98C63", "#7E5238", "#F6C8A3"] as const;
const HAIRS = ["#3B2F2A", "#48342A", "#7E3F2E", "#A3A8B8", "#2B2330", "#C28A00", "#C98A3E"] as const;
const SHIRTS = ["#77216F", "#0E8420", "#1E66BE", "#E95420", "#C28A00", "#5E5C64", "#2C001E"] as const;
const ACCESSORIES = [null, "headphones", "glasses", "earbuds", "cap"] as const;

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function paletteForAgent(name: string): SpriteAgent {
  const h = hashString(name);
  return {
    sprite: {
      skin: SKINS[h % SKINS.length]!,
      hair: HAIRS[(h >> 4) % HAIRS.length]!,
      shirt: SHIRTS[(h >> 8) % SHIRTS.length]!,
      accessory: ACCESSORIES[(h >> 12) % ACCESSORIES.length] ?? null,
    },
  };
}

export function agentHash(name: string): number {
  return hashString(name);
}

export function shortName(name: string): string {
  // First word, capped at 6 chars. "Frontend Architect" → "Front…"; "Arc" → "Arc".
  const first = name.split(/\s+/)[0] ?? name;
  return first.length > 6 ? first.slice(0, 5) + "…" : first;
}
