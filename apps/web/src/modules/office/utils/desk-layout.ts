/**
 * Deterministic seat assignment for the top-down office. Each agent gets a
 * `(tier, slot)` pair derived from its position in the roster - no per-agent
 * persistence needed. 4 sides per pod × 4 pods = 16 seats; overflow wraps.
 *
 * `plant` / `monitor` are visual flags consumed by `iso-office.tsx` to vary
 * desk decoration.
 */

export interface DeskCoords {
  tier: number;
  slot: number;
  plant: boolean;
  monitor: 1 | 2;
}

const SLOTS_PER_TIER = 4;
const MAX_TIERS = 4;

export function deriveDeskCoords(index: number, hash: number): DeskCoords {
  const wrapped = index % (SLOTS_PER_TIER * MAX_TIERS);
  const tier = Math.floor(wrapped / SLOTS_PER_TIER);
  const slot = wrapped % SLOTS_PER_TIER;
  return {
    tier,
    slot,
    plant: hash % 5 < 2,
    monitor: (hash % 3 === 0 ? 2 : 1) as 1 | 2,
  };
}
