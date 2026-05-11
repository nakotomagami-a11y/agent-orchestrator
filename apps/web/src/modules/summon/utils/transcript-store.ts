// Persists per-agent chat transcripts to localStorage so refreshing the
// page (or closing + reopening the modal) doesn't blow the conversation
// away. Schema is intentionally tiny — items match `ThreadItem`, plus an
// optional `activeRunId` so we can try to resume the stream if the run is
// still alive on the server.

import type { ThreadItem } from "./thread-types";

const STORAGE_KEY = "agent-office:chat-transcripts:v1";
const MAX_ITEMS_PER_AGENT = 200;

export interface AgentTranscript {
  items: ThreadItem[];
  /** Last run still considered "in flight" when we serialised. */
  activeRunId?: string | null;
  /** Wall-clock at last write, used for stale detection on resume. */
  updatedAt: number;
}

type Store = Record<string, AgentTranscript>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Store;
    }
  } catch {
    // ignore — fall through to empty
  }
  return {};
}

function write(next: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // QuotaExceeded etc — drop oldest agent and retry once.
    try {
      const agents = Object.keys(next);
      if (agents.length > 0) {
        const sorted = agents
          .map((id) => [id, next[id]!.updatedAt] as const)
          .sort((a, b) => a[1] - b[1]);
        const [oldest] = sorted[0]!;
        const pruned = { ...next };
        delete pruned[oldest];
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
      }
    } catch {
      // give up silently — persistence is best-effort
    }
  }
}

/** Sanitise items before persisting — any "streaming" placeholders get closed. */
function freeze(items: ThreadItem[]): ThreadItem[] {
  return items.map((it) => {
    if (it.kind === "agent-text" && it.streaming) {
      return { ...it, streaming: false };
    }
    return it;
  });
}

export function loadTranscript(agentId: string): AgentTranscript | null {
  const all = read();
  return all[agentId] ?? null;
}

export function saveTranscript(
  agentId: string,
  items: ThreadItem[],
  activeRunId: string | null = null,
): void {
  const all = read();
  all[agentId] = {
    items: freeze(items).slice(-MAX_ITEMS_PER_AGENT),
    activeRunId: activeRunId ?? null,
    updatedAt: Date.now(),
  };
  write(all);
}

export function clearTranscript(agentId: string): void {
  const all = read();
  if (!all[agentId]) return;
  delete all[agentId];
  write(all);
}
