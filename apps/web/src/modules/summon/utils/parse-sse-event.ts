import { z } from "zod";
import { match } from "ts-pattern";
import type { RunStreamEvent } from "@agent-office/shared/types";
import type { ThreadItem, UsageMeter } from "./thread-types";

export interface ApplyResult {
  thread: ThreadItem[];
  usage: UsageMeter;
  done: boolean;
  error: string | null;
}

const attachedSchema = z.object({
  runId: z.string(),
  output: z.string(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  cost: z.number(),
  status: z.enum(["running", "done", "error"]),
  startTs: z.number(),
});

const chunkSchema = z.object({ runId: z.string(), text: z.string() });
const toolSchema = z.object({ runId: z.string(), name: z.string(), input: z.unknown().optional() });
const usageSchema = z.object({
  runId: z.string(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  cost: z.number(),
});
const doneSchema = z.object({ runId: z.string(), exitCode: z.number() });
const errorSchema = z.object({ runId: z.string(), message: z.string() });

const eventSchemas = {
  attached: attachedSchema,
  chunk: chunkSchema,
  tool: toolSchema,
  usage: usageSchema,
  done: doneSchema,
  error: errorSchema,
} as const;

export type SseEventName = keyof typeof eventSchemas;

export function isSseEventName(name: string): name is SseEventName {
  return name in eventSchemas;
}

export function parseSseEvent(name: string, raw: unknown): RunStreamEvent | null {
  if (!isSseEventName(name)) return null;
  const result = eventSchemas[name].safeParse(raw);
  if (!result.success) {
    if (typeof console !== "undefined") {
      console.warn("sse.invalid_payload", { event: name, issues: result.error.issues });
    }
    return null;
  }
  return { name, data: result.data } as RunStreamEvent;
}

export function applySseEvent(
  prev: { thread: ThreadItem[]; usage: UsageMeter },
  event: RunStreamEvent,
): ApplyResult {
  return match(event)
    .with({ name: "attached" }, ({ data }) => {
      const next: ThreadItem[] = [...prev.thread];
      if (data.output && data.output.length > 0 && next.length === 0) {
        next.push({ kind: "agent-text", id: newId(), text: data.output, streaming: data.status === "running" });
      }
      return {
        thread: next,
        usage: { tokensIn: data.tokensIn, tokensOut: data.tokensOut, cost: data.cost },
        done: data.status === "done" || data.status === "error",
        error: null,
      };
    })
    .with({ name: "chunk" }, ({ data }) => ({
      thread: appendTextChunk(prev.thread, data.text),
      usage: prev.usage,
      done: false,
      error: null,
    }))
    .with({ name: "tool" }, ({ data }) => ({
      thread: closeStreaming([
        ...prev.thread,
        { kind: "agent-tool", id: newId(), name: data.name, arg: formatToolArg(data.input) },
      ]),
      usage: prev.usage,
      done: false,
      error: null,
    }))
    .with({ name: "usage" }, ({ data }) => ({
      thread: prev.thread,
      usage: { tokensIn: data.tokensIn, tokensOut: data.tokensOut, cost: data.cost },
      done: false,
      error: null,
    }))
    .with({ name: "done" }, ({ data }) => ({
      thread: closeStreaming([
        ...prev.thread,
        { kind: "system-done", id: newId(), exitCode: data.exitCode },
      ]),
      usage: prev.usage,
      done: true,
      error: null,
    }))
    .with({ name: "error" }, ({ data }) => ({
      thread: closeStreaming([
        ...prev.thread,
        { kind: "system-error", id: newId(), message: data.message },
      ]),
      usage: prev.usage,
      done: false,
      error: data.message,
    }))
    .exhaustive();
}

const newId = (): string => `i_${Math.random().toString(36).slice(2, 10)}`;

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
  if (typeof input === "string") {
    return input.trim().length > 0 ? input : undefined;
  }
  if (typeof input === "object") {
    // Empty objects / arrays carry no information — rendering `{}` next to
    // every tool name just adds visual noise without helping the user
    // understand the call. Drop them here so the UI layer doesn't have to.
    const empty = Array.isArray(input)
      ? input.length === 0
      : Object.keys(input as Record<string, unknown>).length === 0;
    if (empty) return undefined;
  }
  try {
    // Keep the full payload — the tool-card header truncates via CSS ellipsis,
    // and the expanded body needs the complete value to be useful.
    return JSON.stringify(input);
  } catch {
    return undefined;
  }
}
