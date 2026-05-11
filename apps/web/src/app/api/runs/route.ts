import { NextResponse } from "next/server";
import { store, runs as runsService } from "@agent-office/shared/services";
import { validateQuery } from "@/lib/validation";
import { runsQuerySchema } from "@/lib/validation-schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { data: q, error } = validateQuery(runsQuerySchema, url.searchParams);
  if (error) return error;
  const limit = q.limit ?? 50;

  // Merge currently-running live runs (not yet persisted) with finished ones.
  // Live run IDs are excluded from the persisted list to avoid duplicates when
  // a run transitions from running→done between the two reads.
  const liveRunning = runsService.getRunningRuns();
  const liveIds = new Set(liveRunning.map((r) => r.id));
  const all = [...liveRunning, ...store.getRuns().filter((r) => !liveIds.has(r.id))];

  const filtered = all.filter((r) => {
    if (q.agent && r.agentId !== q.agent) return false;
    if (q.project && r.projectId !== q.project) return false;
    if (q.instance && r.instanceId !== q.instance) return false;
    return true;
  });
  return NextResponse.json(filtered.slice(0, limit));
}
