"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { ChatPhase } from "../components/live-status";
import type { ContextProfile } from "@agent-office/domain/types";
import type { ThreadItem } from "../format/thread-types";

export type QueuedMessage = { id: string; text: string };

export type ChatState = {
  thread: ThreadItem[];
  setThread: Dispatch<SetStateAction<ThreadItem[]>>;
  activeRunId: string | null;
  setActiveRunId: Dispatch<SetStateAction<string | null>>;
  sessionId: string | null;
  setSessionId: Dispatch<SetStateAction<string | null>>;
  pendingSeed: string | undefined;
  setPendingSeed: Dispatch<SetStateAction<string | undefined>>;
  phaseOverride: ChatPhase | null;
  setPhaseOverride: Dispatch<SetStateAction<ChatPhase | null>>;
  queuedMessages: QueuedMessage[];
  setQueuedMessages: Dispatch<SetStateAction<QueuedMessage[]>>;
  quotaWarning: string | null;
  setQuotaWarning: Dispatch<SetStateAction<string | null>>;
  contextProfile: ContextProfile;
  setContextProfile: Dispatch<SetStateAction<ContextProfile>>;
  transcriptLoaded: boolean;
  setTranscriptLoaded: Dispatch<SetStateAction<boolean>>;
};

/**
 * All of `ChatPanel`'s useState declarations gathered into one hook so the
 * component body stays presentational. Each field is exposed with its setter
 * so downstream hooks (transcript sync, chat actions, recovery) can drive
 * the state independently.
 */
export function useChatState(): ChatState {
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingSeed, setPendingSeed] = useState<string | undefined>();
  const [phaseOverride, setPhaseOverride] = useState<ChatPhase | null>(null);
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
  const [contextProfile, setContextProfile] = useState<ContextProfile>("balanced");
  const [transcriptLoaded, setTranscriptLoaded] = useState(false);

  return {
    thread, setThread,
    activeRunId, setActiveRunId,
    sessionId, setSessionId,
    pendingSeed, setPendingSeed,
    phaseOverride, setPhaseOverride,
    queuedMessages, setQueuedMessages,
    quotaWarning, setQuotaWarning,
    contextProfile, setContextProfile,
    transcriptLoaded, setTranscriptLoaded,
  };
}
