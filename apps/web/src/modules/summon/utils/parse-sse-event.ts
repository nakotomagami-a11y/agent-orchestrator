import { match, P } from "ts-pattern";
import type { ThreadItem, UsageMeter } from "./thread-types";

/**
 * Pure reducer step. Given the current thread + a parsed SSE payload, returns
 * the next thread + (possibly) a usage update. Keeping it pure makes the live
 * stream behaviour testable without Mock-EventSource gymnastics.
 *
 * SSE event names are the discriminant; payload shapes mirror the server's
 * `runs.SseEvent`.
 */
export interface ApplyResult {
  thread: ThreadItem[];
  usage: UsageMeter;
  done: boolean;
  error: string | null;
}

export interface ParsedSseEvent {
  name: string;
  data: unknown;
}

const newId = (): string => `i_${Math.random().toString(36).slice(2, 10)}`;

export function applySseEvent(
  prev: { thread: ThreadItem[]; usage: UsageMeter },
  event: ParsedSseEvent,
): ApplyResult {
  return match(event)
    .with({ name: "attached", data: P.any }, ({ data }) => {
      const d = data as { output?: string; tokensIn?: number; tokensOut?: number; cost?: number; status?: string };
      const next: ThreadItem[] = [...prev.thread];
      if (d.output && d.output.length > 0 && next.length === 0) {
        next.push({ kind: "agent-text", id: newId(), text: d.output, streaming: d.status === "running" });
      }
      return {
        thread: next,
        usage: {
          tokensIn: d.tokensIn ?? prev.usage.tokensIn,
          tokensOut: d.tokensOut ?? prev.usage.tokensOut,
          cost: d.cost ?? prev.usage.cost,
        },
        done: d.status === "done" || d.status === "error",
        error: null,
      };
    })
    .with({ name: "chunk", data: P.any }, ({ data }) => {
      const d = data as { text: string };
      return {
        thread: appendTextChunk(prev.thread, d.text),
        usage: prev.usage,
        done: false,
        error: null,
      };
    })
    .with({ name: "tool", data: P.any }, ({ data }) => {
      const d = data as { name: string; input?: unknown };
      const arg = formatToolArg(d.input);
      return {
        thread: closeStreaming([
          ...prev.thread,
          { kind: "agent-tool", id: newId(), name: d.name, arg },
        ]),
        usage: prev.usage,
        done: false,
        error: null,
      };
    })
    .with({ name: "usage", data: P.any }, ({ data }) => {
      const d = data as { tokensIn?: number; tokensOut?: number; cost?: number };
      return {
        thread: prev.thread,
        usage: {
          tokensIn: d.tokensIn ?? prev.usage.tokensIn,
          tokensOut: d.tokensOut ?? prev.usage.tokensOut,
          cost: d.cost ?? prev.usage.cost,
        },
        done: false,
        error: null,
      };
    })
    .with({ name: "done", data: P.any }, ({ data }) => {
      const d = data as { exitCode: number };
      return {
        thread: closeStreaming([
          ...prev.thread,
          { kind: "system-done", id: newId(), exitCode: d.exitCode },
        ]),
        usage: prev.usage,
        done: true,
        error: null,
      };
    })
    .with({ name: "error", data: P.any }, ({ data }) => {
      const d = data as { message: string };
      return {
        thread: closeStreaming([
          ...prev.thread,
          { kind: "system-error", id: newId(), message: d.message },
        ]),
        usage: prev.usage,
        done: false,
        error: d.message,
      };
    })
    .otherwise(() => ({ thread: prev.thread, usage: prev.usage, done: false, error: null }));
}

function appendTextChunk(thread: ThreadItem[], text: string): ThreadItem[] {
  const last = thread[thread.length - 1];
  if (last && last.kind === "agent-text" && last.streaming) {
    const updated: ThreadItem = { ...last, text: last.text + text };
    return [...thread.slice(0, -1), updated];
  }
  return [...thread, { kind: "agent-text", id: newId(), text, streaming: true }];
}

function closeStreaming(thread: ThreadItem[]): ThreadItem[] {
  return thread.map((it) =>
    it.kind === "agent-text" && it.streaming ? { ...it, streaming: false } : it,
  );
}

function formatToolArg(input: unknown): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input === "string") return input;
  try {
    const s = JSON.stringify(input);
    return s.length > 120 ? s.slice(0, 117) + "…" : s;
  } catch {
    return undefined;
  }
}
