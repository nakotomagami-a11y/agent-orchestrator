import { GRID_COLS, GRID_ROWS } from "../hooks/use-office-camera";
import { DECORATIONS, type DecorationKind, type DecorationsMap } from "../components/decorations";
import type { AgentPositions } from "../components/office-map";
import type { AgentInstance } from "@agent-office/shared/types";

// Renamed/removed bridge kinds get rewritten on load. The four cap kinds
// (bridge_h_l/r, bridge_v_t/b) are no longer placeable — caps now auto-
// paint on adjacent land cells — so any persisted cap drops silently.
// The middle kinds got shorter names: bridge_h_m → bridge_h, _v_m → _v.
const KIND_MIGRATIONS: Record<string, DecorationKind | null> = {
  bridge_h_m: "bridge_h",
  bridge_v_m: "bridge_v",
  bridge_h_l: null,
  bridge_h_r: null,
  bridge_v_t: null,
  bridge_v_b: null,
};

export function migrateKind(raw: string): DecorationKind | null {
  if (raw in KIND_MIGRATIONS) return KIND_MIGRATIONS[raw] ?? null;
  return raw in DECORATIONS ? (raw as DecorationKind) : null;
}

export function parseGrid(raw: string): boolean[][] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length === GRID_ROWS &&
      parsed.every(
        (row): row is boolean[] =>
          Array.isArray(row) &&
          row.length === GRID_COLS &&
          row.every((cell) => typeof cell === "boolean"),
      )
    ) {
      return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

export function parseDecorations(raw: string): DecorationsMap | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: DecorationsMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") {
        const migrated = migrateKind(value);
        if (migrated) out[key] = [migrated];
        continue;
      }
      if (Array.isArray(value)) {
        const arr: DecorationKind[] = [];
        for (const v of value) {
          if (typeof v !== "string") continue;
          const migrated = migrateKind(v);
          if (migrated) arr.push(migrated);
        }
        if (arr.length > 0) out[key] = arr;
      }
    }
    return out;
  } catch { /* ignore */ }
  return null;
}

export function parseAgentPositions(raw: string): AgentPositions | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: AgentPositions = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        value && typeof value === "object" && !Array.isArray(value) &&
        typeof (value as { agentId?: unknown }).agentId === "string"
      ) {
        const v = value as { agentId: string; instanceId?: unknown };
        out[key] = { agentId: v.agentId, instanceId: typeof v.instanceId === "string" ? v.instanceId : undefined };
      }
    }
    return out;
  } catch { /* ignore */ }
  return null;
}

export function makeSeedGrid(): boolean[][] {
  return Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => false),
  );
}

/**
 * BFS flood-fill: turns connected water cells starting at (startX, startY)
 * into grass. Returns the new grid and the number of cells filled.
 */
export function floodFill(
  grid: boolean[][],
  startX: number,
  startY: number,
): [boolean[][], number] {
  if (grid[startY]?.[startX] === true) return [grid, 0];
  const next = grid.map((row) => [...row]);
  const visited = new Uint8Array(GRID_COLS * GRID_ROWS);
  let head = 0;
  const queue: [number, number][] = [[startX, startY]];
  let count = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++]!;
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) continue;
    const idx = y * GRID_COLS + x;
    if (visited[idx]) continue;
    visited[idx] = 1;
    if (next[y]![x]) continue;
    next[y]![x] = true;
    count++;
    queue.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
  return [next, count];
}

export type Snapshot = {
  grid: boolean[][];
  decorations: DecorationsMap;
  agentPositions: AgentPositions;
};

// Stable empty-array and empty-object fallbacks to avoid recreating them
// on every render (which would defeat React.memo equality checks).
export const EMPTY_ROSTER: AgentInstance[] = [];
export const EMPTY_SPEND: Record<string, number> = {};
