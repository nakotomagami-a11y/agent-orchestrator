import { decorationKey, familyOf, type DecorationsMap } from "../components/decorations";
import { dragRefKey, type DragRef } from "../hooks/use-office-drag";
import type { AgentPositions } from "../components/office-map";

export function isAgentDropValid(
  x: number,
  y: number,
  ref: DragRef,
  grid: boolean[][],
  decorations: DecorationsMap,
  agentPositions: AgentPositions,
): boolean {
  const isGrass = grid[y]?.[x] === true;
  if (!isGrass) {
    const stack = decorations[decorationKey(x, y)];
    if (!(stack && stack.some((k) => familyOf(k) === "bridge"))) return false;
  }
  const existing = agentPositions[decorationKey(x, y)];
  if (!existing) return true;
  return dragRefKey(existing) === dragRefKey(ref);
}
