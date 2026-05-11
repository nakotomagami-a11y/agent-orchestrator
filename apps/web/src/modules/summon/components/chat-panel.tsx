"use client";

import { useEffect, useState } from "react";
import { ChatHead } from "./chat-head";
import { ChatThread } from "./chat-thread";
import { Composer } from "./composer";
import { useSummon, useAbortRun } from "../hooks/use-summon";
import { useRunStream } from "../hooks/use-run-stream";
import type { OfficeAgent } from "@/modules/office/hooks/use-office-agents";
import type { ThreadItem } from "../utils/thread-types";

export type ChatPanelProps = {
  agent: OfficeAgent;
  projectId?: string;
  instanceId?: string;
  onClose: () => void;
};

/**
 * Top-level chat surface. Owns: the local "you" messages, the active runId,
 * and merging stream events into a thread. Stream events live in
 * `useRunStream` so the reducer is testable in isolation.
 */
export function ChatPanel({ agent, projectId, instanceId, onClose }: ChatPanelProps) {
  const summon = useSummon();
  const abort = useAbortRun();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [yourTurns, setYourTurns] = useState<ThreadItem[]>([]);
  const stream = useRunStream(activeRunId);

  useEffect(() => {
    if (stream.phase === "done" || stream.phase === "error") {
      // run finished — clear the live runId so future messages start fresh
      setActiveRunId(null);
    }
  }, [stream.phase]);

  const onSubmit = (text: string) => {
    setYourTurns((prev) => [
      ...prev,
      { kind: "you", id: `y_${Date.now()}`, text },
    ]);
    summon.mutate(
      {
        agentId: agent.id,
        prompt: text,
        projectId,
        instanceId,
      },
      {
        onSuccess: ({ runId }) => setActiveRunId(runId),
      },
    );
  };

  const onAbort = () => {
    if (activeRunId) abort.mutate(activeRunId);
  };

  // Interleave "you" turns with stream items by appearance order.
  // Simple strategy: yourTurns[i] precedes stream messages produced by it.
  // We append them naively — yourTurns appear at the top of each round.
  const merged: ThreadItem[] = [...yourTurns, ...stream.thread];

  const isStreaming = stream.phase === "streaming" || stream.phase === "starting" || summon.isPending;

  return (
    <div className="chat" role="region" aria-label={`Chat with ${agent.name}`}>
      <ChatHead agent={agent} phase={stream.phase} usage={stream.usage} onClose={onClose} />
      <ChatThread items={merged} agentName={agent.name} />
      <Composer
        disabled={isStreaming}
        onSubmit={onSubmit}
        abortable={isStreaming && activeRunId !== null}
        onAbort={onAbort}
      />
    </div>
  );
}
