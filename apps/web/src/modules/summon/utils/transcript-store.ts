// Persists per-instance chat transcripts to localStorage so refreshing the
// page (or closing + reopening the modal) doesn't blow the conversation
// away. Keyed by `<agentId>:<instanceId>` — adding the same agent to a
// project again produces a new instanceId, which means a fresh transcript
// even though the agent definition is the same. The old transcript stays
// in storage for archive viewing.

import type { ThreadItem } from "./thread-types";

const STORAGE_KEY = "agent-office:chat-transcripts:v1";
const MAX_ITEMS_PER_KEY = 200;

export interface Transcript {
  items: ThreadItem[];
  /** Last run still considered "in flight" when we serialised. */
  activeRunId?: string | null;
  /** Wall-clock at last write, used for sorting in the archive view. */
  updatedAt: number;
}

type Store = Record<string, Transcript>;

/**
 * Compose the localStorage key for a specific conversation. `instanceId`
 * is the project-roster identifier — passing `null` means "no project
 * scope" (e.g. clicking an agent card from /agents with no project
 * active), which uses a stable `default` bucket.
 */
export function transcriptKey(agentId: string, instanceId?: string | null): string {
  const slot = instanceId && instanceId.length > 0 ? instanceId : "default";
  return `${agentId}::${slot}`;
}

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
    // QuotaExceeded — drop oldest key and retry once.
    try {
      const keys = Object.keys(next);
      if (keys.length > 0) {
        const sorted = keys
          .map((k) => [k, next[k]!.updatedAt] as const)
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

/** Any in-flight `streaming: true` agent-text items get closed before write. */
function freeze(items: ThreadItem[]): ThreadItem[] {
  return items.map((it) => {
    if (it.kind === "agent-text" && it.streaming) {
      return { ...it, streaming: false };
    }
    return it;
  });
}

export function loadTranscript(key: string): Transcript | null {
  const all = read();
  return all[key] ?? null;
}

export function saveTranscript(
  key: string,
  items: ThreadItem[],
  activeRunId: string | null = null,
): void {
  const all = read();
  all[key] = {
    items: freeze(items).slice(-MAX_ITEMS_PER_KEY),
    activeRunId: activeRunId ?? null,
    updatedAt: Date.now(),
  };
  write(all);
}

export function clearTranscript(key: string): void {
  const all = read();
  if (!all[key]) return;
  delete all[key];
  write(all);
}

/** All transcripts whose key starts with `<agentId>::`. Useful for the
 *  archive view — past instances of the same agent definition. */
export function listAgentTranscripts(agentId: string): Array<{ key: string; transcript: Transcript }> {
  const all = read();
  const prefix = `${agentId}::`;
  const out: Array<{ key: string; transcript: Transcript }> = [];
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith(prefix)) out.push({ key: k, transcript: v });
  }
  return out.sort((a, b) => b.transcript.updatedAt - a.transcript.updatedAt);
}
