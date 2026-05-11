"use client";

import { useEffect, useRef, useState } from "react";
import { API_ROUTES } from "@agent-office/shared/config/routes";
import { applySseEvent, parseSseEvent, type SseEventName } from "../utils/parse-sse-event";
import type { RunPhase, ThreadItem, UsageMeter } from "../utils/thread-types";

const EVENT_NAMES: readonly SseEventName[] = [
  "attached",
  "chunk",
  "tool",
  "usage",
  "done",
  "error",
] as const;

export interface RunStreamState {
  thread: ThreadItem[];
  usage: UsageMeter;
  phase: RunPhase;
  error: string | null;
}

const INITIAL: RunStreamState = {
  thread: [],
  usage: { tokensIn: 0, tokensOut: 0, cost: 0 },
  phase: "idle",
  error: null,
};

type SseHandler = (e: MessageEvent) => void;

/**
 * Subscribes to `/api/runs/[id]/stream`. Returns the live thread + usage +
 * phase. Pass `runId = null` to detach (idle).
 */
export function useRunStream(runId: string | null): RunStreamState {
  const [state, setState] = useState<RunStreamState>(INITIAL);
  const ref = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!runId) {
      setState(INITIAL);
      ref.current?.close();
      ref.current = null;
      return;
    }

    setState({ ...INITIAL, phase: "starting" });
    const url = API_ROUTES.runStream(runId);
    const source = new EventSource(url);
    ref.current = source;

    const handlers = new Map<SseEventName, SseHandler>();

    for (const name of EVENT_NAMES) {
      const handler: SseHandler = (e) => {
        let raw: unknown;
        try {
          raw = JSON.parse(e.data);
        } catch {
          return;
        }
        const event = parseSseEvent(name, raw);
        if (!event) return;
        setState((prev) => {
          const next = applySseEvent({ thread: prev.thread, usage: prev.usage }, event);
          const phase: RunPhase = next.error
            ? "error"
            : next.done
              ? "done"
              : prev.phase === "starting"
                ? "streaming"
                : prev.phase;
          return {
            thread: next.thread,
            usage: next.usage,
            phase,
            error: next.error ?? prev.error,
          };
        });
        if (name === "done") source.close();
      };
      handlers.set(name, handler);
      source.addEventListener(name, handler);
    }

    source.onerror = () => {
      setState((prev) => (prev.phase === "done" ? prev : { ...prev, error: "stream interrupted" }));
    };

    return () => {
      for (const [name, handler] of handlers) source.removeEventListener(name, handler);
      source.close();
      ref.current = null;
    };
  }, [runId]);

  return state;
}
