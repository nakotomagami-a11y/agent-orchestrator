// Persists per-instance chat transcripts to the server DB via /api/transcripts.
// Keyed by `<agentId>::<instanceId>`. Async - callers must await or fire-and-forget.

import type { ThreadItem } from "./thread-types";

const MAX_ITEMS_PER_KEY = 5000;

export interface Transcript {
  items: ThreadItem[];
  activeRunId?: string | null;
  sessionId?: string | null;
  updatedAt: number;
}

export function transcriptKey(agentId: string, instanceId?: string | null): string {
  const slot = instanceId && instanceId.length > 0 ? instanceId : "default";
  return `${agentId}::${slot}`;
}

function parseKey(key: string): { agentId: string; instanceId: string } {
  const idx = key.indexOf("::");
  if (idx === -1) return { agentId: key, instanceId: "default" };
  return { agentId: key.slice(0, idx), instanceId: key.slice(idx + 2) || "default" };
}

function freeze(items: ThreadItem[]): ThreadItem[] {
  return items.map((it) => {
    if (it.kind === "agent-text" && it.streaming) return { ...it, streaming: false };
    return it;
  });
}

export async function loadTranscript(key: string): Promise<Transcript | null> {
  const { agentId, instanceId } = parseKey(key);
  try {
    const res = await fetch(`/api/transcripts?agentId=${encodeURIComponent(agentId)}&instanceId=${encodeURIComponent(instanceId)}`);
    if (!res.ok) return null;
    const data = await res.json() as { items: string; active_run_id?: string | null; activeRunId?: string | null; session_id?: string | null; sessionId?: string | null; updated_at?: number; updatedAt?: number } | null;
    if (!data) return null;
    let items: ThreadItem[] = [];
    try { items = JSON.parse(data.items) as ThreadItem[]; } catch { items = []; }
    return {
      items,
      activeRunId: data.activeRunId ?? data.active_run_id ?? null,
      sessionId: data.sessionId ?? data.session_id ?? null,
      updatedAt: data.updatedAt ?? data.updated_at ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export async function saveTranscript(
  key: string,
  items: ThreadItem[],
  activeRunId: string | null = null,
  sessionId?: string | null,
): Promise<void> {
  const { agentId, instanceId } = parseKey(key);
  try {
    await fetch(
      `/api/transcripts?agentId=${encodeURIComponent(agentId)}&instanceId=${encodeURIComponent(instanceId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: JSON.stringify(freeze(items).slice(-MAX_ITEMS_PER_KEY)),
          activeRunId: activeRunId ?? null,
          sessionId: sessionId !== undefined ? sessionId : null,
        }),
      },
    );
  } catch { /* best-effort */ }
}

export async function clearTranscript(key: string): Promise<void> {
  const { agentId, instanceId } = parseKey(key);
  try {
    await fetch(
      `/api/transcripts?agentId=${encodeURIComponent(agentId)}&instanceId=${encodeURIComponent(instanceId)}`,
      { method: "DELETE" },
    );
  } catch { /* best-effort */ }
}

export async function listAgentTranscripts(agentId: string): Promise<Array<{ key: string; transcript: Transcript }>> {
  // Not implemented for now - returns empty (was only used in archive view)
  void agentId;
  return [];
}
