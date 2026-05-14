import { NextResponse } from "next/server";
import { db } from "@agent-office/shared/services";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  const instanceId = searchParams.get("instanceId") ?? "default";
  if (!agentId) return NextResponse.json({ error: "missing agentId" }, { status: 400 });
  const transcript = db.getTranscript(agentId, instanceId);
  return NextResponse.json(transcript);
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  const instanceId = searchParams.get("instanceId") ?? "default";
  if (!agentId) return NextResponse.json({ error: "missing agentId" }, { status: 400 });
  const body = await request.json() as { items?: string; activeRunId?: string | null; sessionId?: string | null };
  db.saveTranscript(agentId, instanceId, body.items ?? "[]", body.activeRunId ?? null, body.sessionId ?? null);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  const instanceId = searchParams.get("instanceId") ?? "default";
  if (!agentId) return NextResponse.json({ error: "missing agentId" }, { status: 400 });
  db.clearTranscript(agentId, instanceId);
  return NextResponse.json({ ok: true });
}
