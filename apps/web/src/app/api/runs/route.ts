import { NextResponse } from "next/server";
import { store } from "@agent-office/shared/services";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agent = url.searchParams.get("agent");
  const project = url.searchParams.get("project");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.max(1, Math.min(500, Number(limitRaw))) : 50;
  const all = store.getRuns();
  const filtered = all.filter((r) => {
    if (agent && r.agentId !== agent) return false;
    if (project && r.projectId !== project) return false;
    return true;
  });
  return NextResponse.json(filtered.slice(0, limit));
}
