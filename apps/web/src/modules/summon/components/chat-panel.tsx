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
  /** Called when the user clicks "Edit" in the chat head. */
  onEdit?: () => void;
};

/**
 * Top-level chat surface. Owns: local "you" messages, the active runId,
 * and a seed counter that lets New / Branch start a fresh transcript.
 */
export function ChatPanel({ agent, projectId, instanceId, onClose, onEdit }: ChatPanelProps) {
  const summon = useSummon();
  const abort = useAbortRun();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [yourTurns, setYourTurns] = useState<ThreadItem[]>([]);
  const [threadKey, setThreadKey] = useState(0); // bump to remount stream/local state
  const [pendingSeed, setPendingSeed] = useState<string | undefined>(undefined);
  const stream = useRunStream(activeRunId);

  useEffect(() => {
    if (stream.phase === "done" || stream.phase === "error") {
      setActiveRunId(null);
    }
  }, [stream.phase]);

  const onSubmit = (text: string) => {
    setYourTurns((prev) => [...prev, { kind: "you", id: `y_${Date.now()}`, text }]);
    summon.mutate(
      { agentId: agent.id, prompt: text, projectId, instanceId },
      { onSuccess: ({ runId }) => setActiveRunId(runId) },
    );
  };

  const onAbort = () => {
    if (activeRunId) abort.mutate(activeRunId);
  };

  const newThread = () => {
    setYourTurns([]);
    setActiveRunId(null);
    setThreadKey((k) => k + 1);
  };

  const handleCommand = (cmd: string) => {
    if (cmd === "/clear" || cmd === "/branch") newThread();
  };

  const merged: ThreadItem[] = [...yourTurns, ...stream.thread];
  const isStreaming =
    stream.phase === "streaming" || stream.phase === "starting" || summon.isPending;

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
        key={threadKey}
        items={merged}
        agent={agent}
        onPickSuggestion={(text) => setPendingSeed(text)}
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
