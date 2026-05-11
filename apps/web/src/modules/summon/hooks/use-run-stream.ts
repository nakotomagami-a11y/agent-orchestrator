"use client";

import { useEffect, useRef, useState } from "react";
import { API_ROUTES } from "@agent-office/shared/config/routes";
import { applySseEvent } from "../utils/parse-sse-event";
import type { RunPhase, ThreadItem, UsageMeter } from "../utils/thread-types";

const EVENT_NAMES = ["attached", "chunk", "tool", "usage", "done", "error"] as const;

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

    const handlers: Record<(typeof EVENT_NAMES)[number], (e: MessageEvent) => void> = {} as never;
    for (const name of EVENT_NAMES) {
      const handler = (e: MessageEvent) => {
        let data: unknown;
        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }
        setState((prev) => {
          const next = applySseEvent({ thread: prev.thread, usage: prev.usage }, { name, data });
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
      handlers[name] = handler;
      source.addEventListener(name, handler);
    }

    source.onerror = () => {
      // Browser will auto-reconnect by default. Surface the failure but keep
      // the connection alive so a transient network blip doesn't kill the run.
      setState((prev) => (prev.phase === "done" ? prev : { ...prev, error: "stream interrupted" }));
    };

    return () => {
      for (const name of EVENT_NAMES) source.removeEventListener(name, handlers[name]);
      source.close();
      ref.current = null;
    };
  }, [runId]);

  return state;
}
