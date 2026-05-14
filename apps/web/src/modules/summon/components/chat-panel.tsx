"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { match } from "ts-pattern";
import { ChatHead } from "./chat-head";
import { ChatThread } from "./chat-thread";
import { Composer } from "./composer";
import type { ChatPhase } from "./live-status";
import { useSummon, useAbortRun } from "../hooks/use-summon";
import { useRunStream } from "../hooks/use-run-stream";
import { useRunNotification } from "@/hooks/use-run-notification";
import {
  clearTranscript,
  loadTranscript,
  saveTranscript,
  transcriptKey,
} from "../utils/transcript-store";
import { clearDraft } from "../utils/draft-store";
import type { OfficeAgent } from "@/modules/office/hooks/use-office-agents";
import { useProject } from "@/modules/projects/hooks/use-projects";
import type { ThreadItem } from "../utils/thread-types";
import type { PersistedRun } from "@agent-office/shared/types";
import { apiFetch, ApiError } from "@agent-office/shared/hooks/api";
import { API_ROUTES } from "@agent-office/shared/config/routes";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";

export type ChatPanelProps = {
  agent: OfficeAgent;
  projectId?: string;
  instanceId?: string;
  onClose: () => void;
  onEdit?: () => void;
  /** When true, skip rendering the ChatHead (it's provided by the parent shell). */
  noHeader?: boolean;
  /** Incrementing this triggers a new thread. */
  newThreadSignal?: number;
  /** Incrementing this triggers a branch (new thread). */
  branchSignal?: number;
  /** Called with the current active run id (null when idle). */
  onActiveRunChange?: (runId: string | null) => void;
};

/**
 * Top-level chat surface.
 *
 * Persistence: per-agent transcript stored server-side via /api/transcripts.
 * On agent change / refresh / modal close, the thread is restored.
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
export function ChatPanel({ agent, projectId, instanceId, onClose, onEdit, noHeader, newThreadSignal, branchSignal, onActiveRunChange }: ChatPanelProps) {
  const qc = useQueryClient();
  const summon = useSummon();
  const abort = useAbortRun();
  const projectQ = useProject(projectId ?? null);
  const projectName = projectQ.data?.meta.name;

  // Composite key: each `(agentId, instanceId)` pair gets its own
  // transcript. Removing + re-adding an agent yields a new instanceId and
  // therefore a fresh thread, while the old transcript stays in storage
  // for archive viewing.
  const tKey = transcriptKey(agent.id, instanceId);

  // ── State ──
  // `thread` is the canonical transcript shown to the user. Stream items
  // get spliced *into* it via runStartIndexRef, not concatenated alongside.
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcriptLoaded, setTranscriptLoaded] = useState(false);
  const [resumeProbed, setResumeProbed] = useState(false);
  const [resumeError, setResumeError] = useState<
    | { kind: "missing"; message: string }
    | { kind: "transient"; message: string; status?: number }
    | null
  >(null);
  // When a run is recovered from a server restart (exitCode 130), the
  // partial output is spliced into the thread and we surface a recovery
  // banner so the user knows what happened and can pick up where it stopped.
  const [recovered, setRecovered] = useState<
    | { runId: string; partialChars: number; tokensOut: number; cost: number }
    | null
  >(null);
  const [pendingSeed, setPendingSeed] = useState<string | undefined>();
  const [phaseOverride, setPhaseOverride] = useState<ChatPhase | null>(null);
  // Bumped to retry the resume probe after a failure. Lets the user recover
  // from a transient 500 (server hot-reloaded, network blip) without losing
  // the run reference.
  const [resumeAttempt, setResumeAttempt] = useState(0);
  // Local "wall clock" tick that re-renders every second while a run is in
  // flight. Used purely to compute "Xs since last token" against
  // stream.lastEventAt — without this, the staleness display would freeze.
  const [, setTick] = useState(0);
  // Message typed while a run is in progress — fired automatically once the
  // current run finishes. Replacing the value discards the previous queued
  // message, which is the correct behavior for corrections.
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const runStartIndexRef = useRef<number | null>(null);
  const fallbackAttemptedRef = useRef<string | null>(null);

  // ── Agent or instance switch: swap the entire thread state ──
  useEffect(() => {
    setTranscriptLoaded(false);
    setThread([]);
    setActiveRunId(null);
    setSessionId(null);
    setResumeProbed(false);
    setResumeError(null);
    setRecovered(null);
    setPhaseOverride(null);
    runStartIndexRef.current = null;
    fallbackAttemptedRef.current = null;
    let cancelled = false;
    loadTranscript(tKey).then((t) => {
      if (cancelled) return;
      setThread(t?.items ?? []);
      setActiveRunId(t?.activeRunId ?? null);
      setSessionId(t?.sessionId ?? null);
      setTranscriptLoaded(true);
    }).catch(() => {
      if (!cancelled) setTranscriptLoaded(true);
    });
    return () => { cancelled = true; };
  }, [tKey]);

  const stream = useRunStream(activeRunId);

  const runStartTsRef = useRef<number>(0);
  useEffect(() => {
    if (activeRunId) runStartTsRef.current = Date.now();
    onActiveRunChange?.(activeRunId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId]);
  useRunNotification({ agentName: agent.name, phase: stream.phase, startTs: runStartTsRef.current || null });

  // ── Probe a stored runId once — drop it if the server has no record ──
  useEffect(() => {
    if (resumeProbed) return;
    if (!activeRunId) {
      setResumeProbed(true);
      return;
    }
    let cancelled = false;
    setResumeError(null);
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
          // Server-restart kill (SIGINT/SIGTERM → exit code 130): the run
          // didn't complete naturally, but everything streamed up to the
          // moment of death is recoverable. Surface a recovery banner so
          // the user knows they can continue the work instead of starting
          // from scratch.
          if (run.status === "error" && run.exitCode === 130) {
            setRecovered({
              runId: run.id,
              partialChars: run.output?.length ?? 0,
              tokensOut: run.tokensOut,
              cost: run.cost,
            });
          }
          setActiveRunId(null);
        } else {
          // Still running — mark this as where the run output goes so the
          // stream splice has somewhere to land. Use *current* thread length.
          runStartIndexRef.current = thread.length;
        }
        setResumeProbed(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Differentiate "run is genuinely gone" (404) from "server unwell"
        // (5xx, network). For 404 the only useful action is Drop run;
        // Retry would just 404 again. Show that as the primary action.
        if (err instanceof ApiError && err.status === 404) {
          setResumeError({ kind: "missing", message: err.message || "not_found" });
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          const status = err instanceof ApiError ? err.status : undefined;
          setResumeError({ kind: "transient", message: msg || "couldn't reach server", status });
        }
        setResumeProbed(true);
      });
    return () => {
      cancelled = true;
    };
    // We intentionally don't include `thread` — only fire once per runId
    // (resumeAttempt bumps when the user clicks Retry, resetting probed).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId, resumeProbed, resumeAttempt]);

  // ── While a run is in flight, tick once per second so the
  //    "Xs since last token" display updates without waiting for events. ──
  useEffect(() => {
    if (!activeRunId) return;
    if (stream.phase === "done" || stream.phase === "error") return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [activeRunId, stream.phase]);

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

    // Persist the session ID so the next turn can --resume it.
    if (stream.phase === "done" && stream.sessionId) {
      setSessionId(stream.sessionId);
      void saveTranscript(tKey, thread, null, stream.sessionId);
    }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.phase, stream.thread, stream.sessionId, activeRunId, qc, sessionId, transcriptLoaded]);

  // ── Write-through to server DB ──
  useEffect(() => {
    if (!transcriptLoaded) return;
    void saveTranscript(tKey, thread, activeRunId, sessionId);
  }, [tKey, thread, activeRunId, sessionId, transcriptLoaded]);

  // ── Submit ──
  const doSubmit = (text: string) => {
    const userItem: ThreadItem = { kind: "you", id: `y_${Date.now()}`, text };
    setThread((prev) => {
      // The run's output will land right after this "you" turn.
      runStartIndexRef.current = prev.length + 1;
      return [...prev, userItem];
    });
    setPhaseOverride("sending");
    summon.mutate(
      { agentId: agent.id, prompt: text, projectId, instanceId, resumeSessionId: sessionId ?? undefined },
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

  const onSubmit = (text: string) => {
    if (isStreaming) {
      // Queue for after the current run — replacing any previous queued message
      // so corrections ("wait, I meant X") work naturally.
      setQueuedMessage(text);
      return;
    }
    doSubmit(text);
  };

  // ── Abort ──
  const onAbort = () => {
    if (activeRunId) {
      abort.mutate(activeRunId, {
        onSuccess: () => {
          setPhaseOverride("aborted");
          setQueuedMessage(null);
        },
      });
    }
  };

  // ── New / Branch ──
  const newThread = () => {
    void clearTranscript(tKey);
    void clearDraft(tKey);
    setThread([]);
    setActiveRunId(null);
    setSessionId(null);
    setPhaseOverride(null);
    setQueuedMessage(null);
    runStartIndexRef.current = null;
    fallbackAttemptedRef.current = null;
  };

  const handleCommand = (cmd: string) => {
    if (cmd === "/clear" || cmd === "/branch") newThread();
  };

  // External new-thread / branch signals from the parent shell header buttons
  const prevNewThreadRef = useRef(newThreadSignal ?? 0);
  const prevBranchRef = useRef(branchSignal ?? 0);
  useEffect(() => {
    const cur = newThreadSignal ?? 0;
    if (cur !== prevNewThreadRef.current) {
      prevNewThreadRef.current = cur;
      newThread();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newThreadSignal]);
  useEffect(() => {
    const cur = branchSignal ?? 0;
    if (cur !== prevBranchRef.current) {
      prevBranchRef.current = cur;
      newThread();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchSignal]);

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
    ?? match({ pending: summon.isPending, streamPhase: stream.phase, hasText: sliceText.length > 0 })
      .when(({ pending }) => pending, () => "sending" as ChatPhase)
      .when(({ streamPhase }) => streamPhase === "starting", () => "connecting" as ChatPhase)
      .when(({ streamPhase, hasText }) => streamPhase === "streaming" && hasText, () => "streaming" as ChatPhase)
      .when(({ streamPhase }) => streamPhase === "streaming", () => "working" as ChatPhase)
      .when(({ streamPhase }) => streamPhase === "done", () => "done" as ChatPhase)
      .when(({ streamPhase }) => streamPhase === "error", () => "error" as ChatPhase)
      .otherwise(() => "idle" as ChatPhase);

  const isStreaming =
    phase === "sending" || phase === "connecting" || phase === "working" || phase === "streaming";

  // Fire the queued message once the run finishes and all state (session ID,
  // activeRunId) has settled. Watching `phase === "idle"` guarantees the done
  // effect has already committed its state updates in a previous render.
  useEffect(() => {
    if (phase !== "idle") return;
    if (!queuedMessage) return;
    const msg = queuedMessage;
    setQueuedMessage(null);
    doSubmit(msg);
    // doSubmit is defined inline — including it would re-run on every render.
    // The closure captures the right sessionId because this effect only fires
    // after phase becomes idle (i.e. the done effect's state updates landed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, queuedMessage]);

  const elapsedSec =
    runStartTsRef.current && (phase === "working" || phase === "streaming")
      ? Math.floor((Date.now() - runStartTsRef.current) / 1000)
      : 0;
  const totalTok = stream.usage.tokensIn + stream.usage.tokensOut;
  const liveStats =
    elapsedSec > 0
      ? `${fmtElapsed(elapsedSec)}${totalTok > 0 ? ` · ${totalTok.toLocaleString()} tok` : ""}`
      : undefined;

  // ── Staleness detector: tokens are arriving from the SSE but we haven't
  //    seen one in a while. Surfaces "still working… 42s since last token"
  //    so the user can tell the difference between "the agent is thinking"
  //    and "the stream is silently dead". ──
  const STALE_THRESHOLD_MS = 90_000;
  const sinceLastEventMs =
    stream.lastEventAt && isStreaming ? Date.now() - stream.lastEventAt : null;
  const isStale =
    sinceLastEventMs !== null && sinceLastEventMs > STALE_THRESHOLD_MS;

  const retryResume = () => {
    setResumeError(null);
    setResumeProbed(false);
    setResumeAttempt((n) => n + 1);
  };

  const dismissResume = () => {
    setResumeError(null);
    setActiveRunId(null);
    setResumeProbed(true);
  };

  const continueRecovered = () => {
    setRecovered(null);
    setPendingSeed("Please continue where you left off. The previous run was interrupted by a server restart — your partial output is in the thread above.");
  };

  // For "missing run" (404) — the original prompt is gone with the run,
  // but the last user message in our local thread IS the prompt. Re-summon
  // from that, treating the orphan as if it had never been started.
  const resummonLastUserMessage = () => {
    const lastUser = [...thread].reverse().find((it) => it.kind === "you");
    if (!lastUser || lastUser.kind !== "you") return;
    setResumeError(null);
    setActiveRunId(null);
    setResumeProbed(true);
    setPendingSeed(lastUser.text);
  };

  const lastUserMessageText: string | null = (() => {
    const lastUser = [...thread].reverse().find((it) => it.kind === "you");
    return lastUser && lastUser.kind === "you" ? lastUser.text : null;
  })();

  return (
    <div className="chat" role="region" aria-label={`Chat with ${agent.name}`}>
      {!noHeader && (
        <ChatHead
          agent={agent}
          phase={stream.phase}
          usage={stream.usage}
          onBranch={newThread}
          onNew={newThread}
          onEdit={onEdit}
        />
      )}

      {/* Diagnostic banners — only one shown at a time, ordered by severity.
          Recovered > resume-missing > resume-transient > lost > retrying > stale. */}
      {recovered ? (
        <StreamBanner
          kind="warn"
          title="Recovered partial output from the previous run."
          detail={`Run ${recovered.runId} was interrupted by a server restart (exit 130). ${recovered.partialChars.toLocaleString()} chars · ${recovered.tokensOut.toLocaleString()} tok · $${recovered.cost.toFixed(3)} streamed before the kill — appended to the thread above. Click Continue to pick up where it stopped.`}
          primary={{ label: "Continue", onClick: continueRecovered }}
          secondary={{ label: "Dismiss", onClick: () => setRecovered(null) }}
        />
      ) : resumeError?.kind === "missing" ? (
        <StreamBanner
          kind="warn"
          title="This run isn't on the server anymore."
          detail={`Run ${activeRunId} · ${resumeError.message}. Most likely the server restarted while it was in flight, so it never made it into runs.log. ${
            lastUserMessageText
              ? "Re-summon will re-send your last message as a fresh run; Drop run leaves the chat as-is."
              : "Drop run clears the dead reference. (No previous user message in the thread to re-send.)"
          }`}
          primary={
            lastUserMessageText
              ? { label: "Re-summon last message", onClick: resummonLastUserMessage }
              : { label: "Drop run", onClick: dismissResume }
          }
          secondary={
            lastUserMessageText
              ? { label: "Drop run", onClick: dismissResume }
              : undefined
          }
        />
      ) : resumeError?.kind === "transient" ? (
        <StreamBanner
          kind="error"
          title={
            resumeError.status
              ? `Server returned ${resumeError.status} when resuming this run.`
              : "Couldn't reach the server to resume this run."
          }
          detail={`Run ${activeRunId} · ${resumeError.message}`}
          primary={{ label: "Retry", onClick: retryResume }}
          secondary={{ label: "Drop run", onClick: dismissResume }}
        />
      ) : stream.connection === "lost" ? (
        <StreamBanner
          kind="error"
          title="Stream connection lost."
          detail={
            stream.error ??
            "The browser gave up on the EventSource. The run may still be in flight on the server."
          }
          primary={{ label: "Reconnect", onClick: stream.reconnect }}
        />
      ) : stream.connection === "retrying" ? (
        <StreamBanner
          kind="warn"
          title="Stream connection interrupted — reconnecting…"
          detail="Browser is retrying automatically. Click Reconnect if it doesn't recover."
          primary={{ label: "Reconnect now", onClick: stream.reconnect }}
        />
      ) : isStale && sinceLastEventMs !== null ? (
        <StreamBanner
          kind="warn"
          title={`No new output for ${Math.floor(sinceLastEventMs / 1000)}s — still waiting.`}
          detail={
            stream.lastEventAt
              ? `Last event at ${new Date(stream.lastEventAt).toLocaleTimeString()}. The agent may be thinking, or the stream may be silently stuck.`
              : "No events received yet."
          }
          primary={{ label: "Reconnect", onClick: stream.reconnect }}
        />
      ) : null}

      <ChatThread
        items={thread}
        agent={agent}
        onPickSuggestion={(text) => setPendingSeed(text)}
        onSubmit={isStreaming ? undefined : onSubmit}
        phase={phase}
        phaseHint={phaseHint(phase, stream.usage)}
        phaseStats={liveStats}
        queuedMessage={queuedMessage}
        onCancelQueue={() => setQueuedMessage(null)}
      />
      {/* key=tKey forces a fresh Composer mount whenever the agent or
          instance changes, ensuring useState re-initialises from the correct
          draft slot rather than showing the previous agent's text. */}
      <Composer
        key={tKey}
        onSubmit={onSubmit}
        abortable={isStreaming && activeRunId !== null}
        onAbort={onAbort}
        agentId={agent.id}
        projectId={projectId}
        modelChip={agent.defaultModel ?? "default"}
        cwdChip={projectName ? `project: ${projectName}` : projectId ? `project: ${projectId}` : undefined}
        seed={pendingSeed}
        onCommand={handleCommand}
        draftKey={tKey}
      />
    </div>
  );
}

function fmtElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
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

type BannerAction = { label: string; onClick: () => void };

/**
 * Inline alert strip rendered between the chat head and thread. Verbose by
 * design — this app is for developers, so the user sees the actual error
 * string, the run id, and a primary action they can take.
 */
function StreamBanner({
  kind,
  title,
  detail,
  primary,
  secondary,
}: {
  kind: "warn" | "error";
  title: string;
  detail?: string;
  primary?: BannerAction;
  secondary?: BannerAction;
}) {
  const colour = kind === "error" ? "var(--error)" : "var(--queued)";
  return (
    <div
      role="alert"
      style={{
        margin: "8px 24px 0",
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${colour}`,
        background:
          kind === "error"
            ? "color-mix(in oklch, var(--error) 10%, transparent)"
            : "color-mix(in oklch, var(--queued) 12%, transparent)",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: colour }}>{title}</div>
        {detail ? (
          <div
            style={{
              marginTop: 3,
              fontSize: 11.5,
              color: "var(--txt-2)",
              fontFamily: "var(--font-mono)",
              wordBreak: "break-word",
            }}
          >
            {detail}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {secondary ? (
          <button
            type="button"
            className="btn sm ghost"
            onClick={secondary.onClick}
          >
            {secondary.label}
          </button>
        ) : null}
        {primary ? (
          <button
            type="button"
            className="btn sm"
            onClick={primary.onClick}
            style={{ borderColor: colour, color: colour }}
          >
            {primary.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
