"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChatHead } from "./chat-head";
import { ChatThread } from "./chat-thread";
import { Composer } from "./composer";
import type { ChatPhase } from "./live-status";
import { useSummon, useAbortRun } from "../hooks/use-summon";
import { useRunStream } from "../hooks/use-run-stream";
import {
  clearTranscript,
  loadTranscript,
  saveTranscript,
  transcriptKey,
} from "../utils/transcript-store";
import type { OfficeAgent } from "@/modules/office/hooks/use-office-agents";
import type { ThreadItem } from "../utils/thread-types";
import type { PersistedRun } from "@agent-office/shared/types";
import { apiFetch } from "@agent-office/shared/hooks/api";
import { API_ROUTES } from "@agent-office/shared/config/routes";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";

export type ChatPanelProps = {
  agent: OfficeAgent;
  projectId?: string;
  instanceId?: string;
  onClose: () => void;
  onEdit?: () => void;
};

/**
 * Top-level chat surface.
 *
 * Persistence: per-agent transcript in localStorage. On agent change /
 * refresh / modal close, the thread is restored.
 *
 * Reliability: a `runStartIndex` ref marks where the *current* run's
 * output begins in `thread`. The SSE stream's incremental items splice
 * into that slice on every update, so the visible thread is always the
 * single source of truth and the committed items never duplicate the
 * live stream view.
 *
 * Recovery: a stored `activeRunId` is probed once via /api/runs/[id] —
 * if the server still has it live, the SSE re-attach picks it up; if
 * it's already finished, we fall back to the persisted run's output so
 * the user actually sees the result instead of an empty bubble.
 */
export function ChatPanel({ agent, projectId, instanceId, onClose, onEdit }: ChatPanelProps) {
  const qc = useQueryClient();
  const summon = useSummon();
  const abort = useAbortRun();

  // Composite key: each `(agentId, instanceId)` pair gets its own
  // transcript. Removing + re-adding an agent yields a new instanceId and
  // therefore a fresh thread, while the old transcript stays in storage
  // for archive viewing.
  const tKey = transcriptKey(agent.id, instanceId);

  // ── State ──
  // `thread` is the canonical transcript shown to the user. Stream items
  // get spliced *into* it via runStartIndexRef, not concatenated alongside.
  const [thread, setThread] = useState<ThreadItem[]>(() => loadTranscript(tKey)?.items ?? []);
  const [activeRunId, setActiveRunId] = useState<string | null>(
    () => loadTranscript(tKey)?.activeRunId ?? null,
  );
  const [resumeProbed, setResumeProbed] = useState(false);
  const [pendingSeed, setPendingSeed] = useState<string | undefined>();
  const [phaseOverride, setPhaseOverride] = useState<ChatPhase | null>(null);
  const runStartIndexRef = useRef<number | null>(null);
  const fallbackAttemptedRef = useRef<string | null>(null);

  // ── Agent or instance switch: swap the entire thread state ──
  useEffect(() => {
    const t = loadTranscript(tKey);
    setThread(t?.items ?? []);
    setActiveRunId(t?.activeRunId ?? null);
    setResumeProbed(false);
    setPhaseOverride(null);
    runStartIndexRef.current = null;
    fallbackAttemptedRef.current = null;
  }, [tKey]);

  const stream = useRunStream(activeRunId);

  // ── Probe a stored runId once — drop it if the server has no record ──
  useEffect(() => {
    if (resumeProbed) return;
    if (!activeRunId) {
      setResumeProbed(true);
      return;
    }
    let cancelled = false;
    apiFetch<PersistedRun>(API_ROUTES.run(activeRunId))
      .then((run) => {
        if (cancelled) return;
        if (run.status !== "running") {
          // Already finished while we were away — append its persisted
          // output, then drop the id so the stream effect won't try to
          // reattach.
          if (run.output && run.output.trim().length > 0) {
            setThread((prev) => [
              ...prev,
              { kind: "agent-text", id: `r_${activeRunId}`, text: run.output, streaming: false },
            ]);
          }
          setActiveRunId(null);
        } else {
          // Still running — mark this as where the run output goes so the
          // stream splice has somewhere to land. Use *current* thread length.
          runStartIndexRef.current = thread.length;
        }
      })
      .catch(() => {
        if (cancelled) return;
        setActiveRunId(null);
      })
      .finally(() => {
        if (!cancelled) setResumeProbed(true);
      });
    return () => {
      cancelled = true;
    };
    // We intentionally don't include `thread` — only fire once per runId.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId, resumeProbed]);

  // ── Splice live stream items into the canonical thread ──
  useEffect(() => {
    const startIdx = runStartIndexRef.current;
    if (startIdx === null) return;
    if (stream.thread.length === 0 && stream.phase !== "done" && stream.phase !== "error") return;
    setThread((prev) => {
      // If startIdx is somehow past the end (shouldn't happen but be safe),
      // pin it to the end so we append rather than corrupt.
      const safeIdx = Math.min(startIdx, prev.length);
      return [...prev.slice(0, safeIdx), ...stream.thread];
    });
  }, [stream.thread, stream.phase]);

  // ── On done/error: clear the run slot, fall back if no text ──
  useEffect(() => {
    if (stream.phase !== "done" && stream.phase !== "error") return;
    if (!activeRunId) return;
    const runId = activeRunId;
    const startIdx = runStartIndexRef.current;

    const hasText = stream.thread.some(
      (it) => it.kind === "agent-text" && it.text.trim().length > 0,
    );
    const shouldFallback = stream.phase === "done" && !hasText && fallbackAttemptedRef.current !== runId;

    runStartIndexRef.current = null;
    fallbackAttemptedRef.current = runId;
    setActiveRunId(null);
    qc.invalidateQueries({ queryKey: queryKeys.runs.all });

    if (!shouldFallback) return;
    apiFetch<PersistedRun>(API_ROUTES.run(runId))
      .then((run) => {
        if (!run.output || run.output.trim().length === 0) return;
        setThread((prev) => {
          if (startIdx === null) return prev;
          // Insert the persisted output at the run slot so user sees the
          // text even though SSE didn't deliver it.
          const before = prev.slice(0, startIdx);
          const after = prev.slice(startIdx);
          const fallback: ThreadItem = {
            kind: "agent-text",
            id: `r_${runId}`,
            text: run.output,
            streaming: false,
          };
          return [...before, fallback, ...after];
        });
      })
      .catch(() => {
        // ignore — we already cleared the run, user can retry
      });
  }, [stream.phase, stream.thread, activeRunId, qc]);

  // ── Write-through to localStorage ──
  useEffect(() => {
    saveTranscript(tKey, thread, activeRunId);
  }, [tKey, thread, activeRunId]);

  // ── Submit ──
  const onSubmit = (text: string) => {
    const userItem: ThreadItem = { kind: "you", id: `y_${Date.now()}`, text };
    setThread((prev) => {
      // The run's output will land right after this "you" turn.
      runStartIndexRef.current = prev.length + 1;
      return [...prev, userItem];
    });
    setPhaseOverride("sending");
    summon.mutate(
      { agentId: agent.id, prompt: text, projectId, instanceId },
      {
        onSuccess: ({ runId }) => {
          setActiveRunId(runId);
          setPhaseOverride(null);
        },
        onError: (err) => {
          runStartIndexRef.current = null;
          setThread((prev) => [
            ...prev,
            {
              kind: "system-error",
              id: `e_${Date.now()}`,
              message: err instanceof Error ? err.message : String(err),
            },
          ]);
          setPhaseOverride(null);
        },
      },
    );
  };

  // ── Abort ──
  const onAbort = () => {
    if (activeRunId) {
      abort.mutate(activeRunId, {
        onSuccess: () => setPhaseOverride("aborted"),
      });
    }
  };

  // ── New / Branch ──
  const newThread = () => {
    clearTranscript(tKey);
    setThread([]);
    setActiveRunId(null);
    setPhaseOverride(null);
    runStartIndexRef.current = null;
    fallbackAttemptedRef.current = null;
  };

  const handleCommand = (cmd: string) => {
    if (cmd === "/clear" || cmd === "/branch") newThread();
  };

  // ── Phase ──
  const sliceText = useMemo(() => {
    const startIdx = runStartIndexRef.current ?? thread.length;
    const slice = thread.slice(startIdx);
    let out = "";
    for (const it of slice) {
      if (it.kind === "agent-text") out += it.text;
    }
    return out;
  }, [thread]);

  const phase: ChatPhase = phaseOverride
    ? phaseOverride
    : summon.isPending
      ? "sending"
      : stream.phase === "starting"
        ? "connecting"
        : stream.phase === "streaming"
          ? sliceText.length > 0
            ? "streaming"
            : "working"
          : stream.phase === "done"
            ? "done"
            : stream.phase === "error"
              ? "error"
              : "idle";

  const isStreaming =
    phase === "sending" || phase === "connecting" || phase === "working" || phase === "streaming";

  return (
    <div className="chat" role="region" aria-label={`Chat with ${agent.name}`}>
      <ChatHead
        agent={agent}
        phase={stream.phase}
        usage={stream.usage}
        onBranch={newThread}
        onNew={newThread}
        onEdit={onEdit}
      />
      <ChatThread
        items={thread}
        agent={agent}
        onPickSuggestion={(text) => setPendingSeed(text)}
        phase={phase}
        phaseHint={phaseHint(phase, stream.usage)}
      />
      <Composer
        disabled={isStreaming}
        onSubmit={onSubmit}
        abortable={isStreaming && activeRunId !== null}
        onAbort={onAbort}
        modelChip={agent.defaultModel ?? "default"}
        cwdChip={projectId ? `project: ${projectId}` : undefined}
        seed={pendingSeed}
        onCommand={handleCommand}
      />
    </div>
  );
}

function phaseHint(
  phase: ChatPhase,
  usage: { tokensIn: number; tokensOut: number; cost: number },
): string | undefined {
  if (phase === "streaming") {
    return `${usage.tokensOut.toLocaleString()} tok · $${usage.cost.toFixed(3)}`;
  }
  if (phase === "done") {
    return `${(usage.tokensIn + usage.tokensOut).toLocaleString()} tok · $${usage.cost.toFixed(3)}`;
  }
  return undefined;
}
