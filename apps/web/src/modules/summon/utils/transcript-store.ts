// Persists per-instance chat transcripts to the server DB via /api/transcripts.
// Keyed by `<agentId>::<instanceId>`. Async - callers must await or fire-and-forget.

import { API_ROUTES } from "@agent-office/shared/config/routes";
import { apiClient } from "@/lib/api-client";
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
    const res = await apiClient.get<{ items: string; activeRunId?: string | null; sessionId?: string | null; updatedAt?: number } | null>(
      API_ROUTES.transcripts,
      { params: { agentId, instanceId } },
    );
    const data = res.data;
    if (!data) return null;
    let items: ThreadItem[] = [];
    try { items = JSON.parse(data.items) as ThreadItem[]; } catch { items = []; }
    return {
      items,
      activeRunId: data.activeRunId ?? null,
      sessionId: data.sessionId ?? null,
      updatedAt: data.updatedAt ?? Date.now(),
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
    await apiClient.put(
      API_ROUTES.transcripts,
      {
        items: JSON.stringify(freeze(items).slice(-MAX_ITEMS_PER_KEY)),
        activeRunId: activeRunId ?? null,
        sessionId: sessionId !== undefined ? sessionId : null,
      },
      { params: { agentId, instanceId } },
    );
  } catch { /* best-effort */ }
}

export async function clearTranscript(key: string): Promise<void> {
  const { agentId, instanceId } = parseKey(key);
  try {
    await apiClient.delete(API_ROUTES.transcripts, { params: { agentId, instanceId } });
  } catch { /* best-effort */ }
}

export async function listAgentTranscripts(
  agentId: string,
): Promise<Array<{ instanceId: string; sessionId: string | null; updatedAt: number }>> {
  try {
    const res = await apiClient.get<Array<{ instanceId: string; sessionId: string | null; updatedAt: number }>>(
      API_ROUTES.transcripts,
      { params: { agentId } },
    );
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}
