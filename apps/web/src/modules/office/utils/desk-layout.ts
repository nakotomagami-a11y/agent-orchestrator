// Pure desk-assignment + visual prop derivation. Each agent gets a deterministic
// (tier, slot) based on its position in the roster — no per-agent persistence
// needed. 4 slots per tier, 4 tiers max (16 agents). Overflow wraps.

import { isoXY, stageDimensions, TILE_W } from "./iso-coords";

export interface DeskCoords {
  tier: number;
  slot: number;
  plant: boolean;
  monitor: 1 | 2;
}

export interface DeskPosition {
  x: number;
  y: number;
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
    // Two of every five agents get a plant; one in three a dual-monitor.
    plant: hash % 5 < 2,
    monitor: (hash % 3 === 0 ? 2 : 1) as 1 | 2,
  };
}

/**
 * Top-left corner of a 96px-wide desk for the given (tier, slot). Mirrors the
 * v3 reference which renders desks at `pos.x - 48, pos.y - 40`.
 */
export function deskPosition(tier: number, slot: number): DeskPosition {
  const { offsetX, offsetY } = stageDimensions();
  const row = 5 - tier;
  const col = 1 + slot * 2;
  const { x, y } = isoXY(col, row);
  return { x: x + offsetX - TILE_W * 0.75, y: y + offsetY - 40 };
}
