"use client";

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { loadTranscript, saveTranscript } from "../format/transcript-store";
import type { ThreadItem } from "../format/thread-types";

export type TranscriptSyncInput = {
  tKey: string;
  thread: ThreadItem[];
  setThread: Dispatch<SetStateAction<ThreadItem[]>>;
  activeRunId: string | null;
  setActiveRunId: Dispatch<SetStateAction<string | null>>;
  sessionId: string | null;
  setSessionId: Dispatch<SetStateAction<string | null>>;
  queuedMessages: Array<{ id: string; text: string }>;
  setQueuedMessages: Dispatch<SetStateAction<Array<{ id: string; text: string }>>>;
  setPhaseOverride: (v: null) => void;
  runStartIndexRef: MutableRefObject<number | null>;
  resetRecovery: () => void;
  /** Caller-owned so it can also be a dep of `useRunRecovery`. */
  transcriptLoaded: boolean;
  setTranscriptLoaded: Dispatch<SetStateAction<boolean>>;
};

export type TranscriptSyncResult = {
  loadedTKeyRef: MutableRefObject<string | null>;
};

/**
 * Owns the transcript persistence lifecycle for `ChatPanel`:
 *
 * - On `tKey` change, resets thread state and re-loads the row for that key.
 * - Guards the write-through effect with a ref so a stale render from the
 *   *previous* tKey can't clobber the new key's row (see the ref comment in
 *   the original chat-panel implementation for the full race description).
 *
 * The consumer stays responsible for owning the actual thread/activeRunId/
 * sessionId/queuedMessages state — this hook just synchronises it with the
 * server transcript row.
 */
export function useTranscriptSync(input: TranscriptSyncInput): TranscriptSyncResult {
  const loadedTKeyRef = useRef<string | null>(null);
  useLoadEffect(input, loadedTKeyRef);
  useWriteThroughEffect(input, loadedTKeyRef);
  return { loadedTKeyRef };
}

function useLoadEffect(input: TranscriptSyncInput, loadedTKeyRef: MutableRefObject<string | null>): void {
  const {
    tKey,
    setThread,
    setActiveRunId,
    setSessionId,
    setQueuedMessages,
    setPhaseOverride,
    runStartIndexRef,
    resetRecovery,
    setTranscriptLoaded,
  } = input;

  useEffect(() => {
    setTranscriptLoaded(false);
    setThread([]);
    setActiveRunId(null);
    setSessionId(null);
    setPhaseOverride(null);
    setQueuedMessages([]);
    // Invalidate the write-through guard immediately — see chat-panel comment.
    loadedTKeyRef.current = null;
    resetRecovery();
    let cancelled = false;
    loadTranscript(tKey).then((row) => {
      if (cancelled) return;
      const items = row?.items ?? [];
      setThread(items);
      setActiveRunId(row?.activeRunId ?? null);
      setSessionId(row?.sessionId ?? null);
      setQueuedMessages(row?.queuedMessages ?? []);
      // Pre-set the splice index NOW, before the first render that carries
      // activeRunId — the EventSource opens synchronously on that render.
      if (row?.activeRunId) runStartIndexRef.current = items.length;
      loadedTKeyRef.current = tKey;
      setTranscriptLoaded(true);
    }).catch(() => {
      if (cancelled) return;
      // Even on load failure the state is "empty for this key" — allow
      // future edits to be persisted under it.
      loadedTKeyRef.current = tKey;
      setTranscriptLoaded(true);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on tKey change only; setters and refs are stable
  }, [tKey]);
}

function useWriteThroughEffect(input: TranscriptSyncInput, loadedTKeyRef: MutableRefObject<string | null>): void {
  const { tKey, thread, activeRunId, sessionId, queuedMessages, transcriptLoaded } = input;
  useEffect(() => {
    if (!transcriptLoaded) return;
    if (loadedTKeyRef.current !== tKey) return;
    void saveTranscript(tKey, thread, activeRunId, sessionId, queuedMessages);
  }, [tKey, thread, activeRunId, sessionId, transcriptLoaded, queuedMessages, loadedTKeyRef]);
}
