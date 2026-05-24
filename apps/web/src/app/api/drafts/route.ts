import { NextResponse } from "next/server";
import { db } from "@agent-office/shared/services";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  const instanceId = searchParams.get("instanceId") ?? "default";
  if (!agentId) return NextResponse.json({ error: "missing agentId" }, { status: 400 });
  const text = db.getDraft(agentId, instanceId);
  return NextResponse.json({ text });
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  const instanceId = searchParams.get("instanceId") ?? "default";
  if (!agentId) return NextResponse.json({ error: "missing agentId" }, { status: 400 });
  let body: { text: string };
  try { body = await request.json() as { text: string }; } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  db.saveDraft(agentId, instanceId, body.text ?? "");
  return NextResponse.json({ ok: true });
}
