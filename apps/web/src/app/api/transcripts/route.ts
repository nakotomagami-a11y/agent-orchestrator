import { NextResponse } from "next/server";
import { db } from "@agent-office/shared/services";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ error: "missing agentId" }, { status: 400 });
  const instanceId = searchParams.get("instanceId");
  if (instanceId === null) {
    return NextResponse.json(db.listAgentTranscripts(agentId));
  }
  const transcript = db.getTranscript(agentId, instanceId || "default");
  return NextResponse.json(transcript);
}

const TRANSCRIPT_MAX_BYTES = 5 * 1024 * 1024;

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  const instanceId = searchParams.get("instanceId") ?? "default";
  if (!agentId) return NextResponse.json({ error: "missing agentId" }, { status: 400 });
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && parseInt(contentLength, 10) > TRANSCRIPT_MAX_BYTES) {
    return NextResponse.json({ error: "payload_too_large", maxBytes: TRANSCRIPT_MAX_BYTES }, { status: 413 });
  }
  let body: { items?: string; activeRunId?: string | null; sessionId?: string | null };
  try { body = await request.json() as typeof body; } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.items === "string") {
    try { JSON.parse(body.items); } catch {
      return NextResponse.json({ error: "items_not_valid_json" }, { status: 400 });
    }
  }
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
