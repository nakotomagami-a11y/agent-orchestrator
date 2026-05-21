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

/**
 * Connection lifecycle, tracked separately from `phase` so the UI can show
 * "still reconnecting…" or "connection lost" even when the logical run phase
 * would otherwise look fine. EventSource auto-retries on its own, so we only
 * mark `lost` after the browser gave up - at which point the user has to
 * trigger a manual reconnect.
 */
export type ConnectionState = "idle" | "connecting" | "open" | "retrying" | "lost";

export interface RunStreamState {
  thread: ThreadItem[];
  usage: UsageMeter;
  phase: RunPhase;
  error: string | null;
  connection: ConnectionState;
  /** Epoch ms when we last received any SSE event. Null until first event. */
  lastEventAt: number | null;
  /** Session ID from the completed run - available once phase is "done". */
  sessionId: string | null;
  /** Epoch ms when the run started on the server - set from the attached event. */
  startTs: number | null;
}

const INITIAL: RunStreamState = {
  thread: [],
  usage: { tokensIn: 0, tokensOut: 0, cost: 0 },
  phase: "idle",
  error: null,
  connection: "idle",
  lastEventAt: null,
  sessionId: null,
  startTs: null,
};

type SseHandler = (e: MessageEvent) => void;

const MAX_RETRY_ATTEMPTS = 3;

export interface UseRunStreamResult extends RunStreamState {
  /** Force-close the current EventSource and start a new one. No-op when idle. */
  reconnect: () => void;
}

export function useRunStream(runId: string | null): UseRunStreamResult {
  const [state, setState] = useState<RunStreamState>(INITIAL);
  // Bumped to force the effect below to re-run and open a new EventSource.
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const ref = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!runId) {
      setState(INITIAL);
      ref.current?.close();
      ref.current = null;
      retryCountRef.current = 0;
      return;
    }

    retryCountRef.current = 0;
    setState({ ...INITIAL, phase: "starting", connection: "connecting" });
    const url = API_ROUTES.runStream(runId);
    const source = new EventSource(url);
    ref.current = source;

    const handlers = new Map<SseEventName, SseHandler>();

    // EventSource fires an `open` event whenever the underlying connection
    // (re)opens - covers both the first connect and any automatic reconnect
    // after a transient drop. Reset the retry counter so a healthy reconnect
    // doesn't carry old failures into the next disconnect.
    const onOpen = () => {
      retryCountRef.current = 0;
      setState((prev) => ({ ...prev, connection: "open" }));
    };
    source.addEventListener("open", onOpen);

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
        const now = Date.now();
        setState((prev) => {
          const next = applySseEvent({ thread: prev.thread, usage: prev.usage, startTs: prev.startTs }, event);
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
            connection: "open",
            lastEventAt: now,
            sessionId: next.sessionId !== undefined ? next.sessionId : prev.sessionId,
            startTs: next.startTs !== undefined ? next.startTs : prev.startTs,
          };
        });
        if (name === "done") source.close();
      };
      handlers.set(name, handler);
      source.addEventListener(name, handler);
    }

    source.onerror = () => {
      // EventSource readyState: 0=connecting, 1=open, 2=closed. The browser
      // auto-retries while readyState===0, so distinguish "still trying" from
      // "browser gave up" (readyState===2).
      const givenUp = source.readyState === 2;
      retryCountRef.current += 1;

      if (givenUp || retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
        try {
          source.close();
        } catch {
          /* already closed */
        }
        setState((prev) => ({
          ...prev,
          connection: "lost",
          error: prev.error ?? "stream connection lost",
        }));
        return;
      }

      setState((prev) => ({ ...prev, connection: "retrying" }));
    };

    return () => {
      source.removeEventListener("open", onOpen);
      for (const [name, handler] of handlers) source.removeEventListener(name, handler);
      source.close();
      ref.current = null;
    };
  }, [runId, reconnectNonce]);

  return { ...state, reconnect: () => setReconnectNonce((n) => n + 1) };
}
