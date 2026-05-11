import { NextResponse } from "next/server";
import { store } from "@agent-office/shared/services";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agent = url.searchParams.get("agent");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.max(1, Math.min(500, Number(limitRaw))) : 50;
  const all = store.getRuns();
  const filtered = agent ? all.filter((r) => r.agentId === agent) : all;
  return NextResponse.json(filtered.slice(0, limit));
}
