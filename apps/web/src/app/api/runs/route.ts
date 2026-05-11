import { NextResponse } from "next/server";
import { store } from "@agent-office/shared/services";
import { validateQuery } from "@/lib/validation";
import { runsQuerySchema } from "@/lib/validation-schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { data: q, error } = validateQuery(runsQuerySchema, url.searchParams);
  if (error) return error;
  const limit = q.limit ?? 50;
  const all = store.getRuns();
  const filtered = all.filter((r) => {
    if (q.agent && r.agentId !== q.agent) return false;
    if (q.project && r.projectId !== q.project) return false;
    return true;
  });
  return NextResponse.json(filtered.slice(0, limit));
}
