import type { PersistedRun } from "@agent-office/shared/types";

function isoDay(ts: number): string {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function buildSparkData(
  runs: PersistedRun[],
  metric: (r: PersistedRun) => number,
): number[] {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86_400_000);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
  return days.map((d) =>
    runs.filter((r) => isoDay(r.ts) === d).reduce((s, r) => s + metric(r), 0),
  );
}

export function buildHeatmapGrid(runs: PersistedRun[]): number[][] {
  const now = new Date();
  const result: number[][] = [];
  for (let d = 6; d >= 0; d--) {
    const row: number[] = new Array(24).fill(0);
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - d);
    const dayEnd = dayStart.getTime() + 86_400_000;
    for (const r of runs) {
      if (r.ts >= dayStart.getTime() && r.ts < dayEnd) {
        const h = new Date(r.ts).getHours();
        row[h] = (row[h] ?? 0) + 1;
      }
    }
    result.push(row);
  }
  return result;
}

export function findBusiestCell(grid: number[][]): { d: number; h: number; v: number } {
  let best = { d: 0, h: 0, v: 0 };
  grid.forEach((row, d) =>
    row.forEach((v, h) => {
      if (v > best.v) best = { d, h, v };
    }),
  );
  return best;
}

export function classifyHeatmapLevel(v: number, max: number): "" | "l1" | "l2" | "l3" | "l4" {
  if (v === 0) return "";
  const r = v / max;
  if (r < 0.25) return "l1";
  if (r < 0.5) return "l2";
  if (r < 0.8) return "l3";
  return "l4";
}
