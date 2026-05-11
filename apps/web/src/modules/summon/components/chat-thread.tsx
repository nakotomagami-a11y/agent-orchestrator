"use client";

import { useEffect, useRef } from "react";
import { PixelSprite } from "@/components/ui/pixel-sprite";
import { MessageBubble } from "./message-bubble";
import { LiveStatus, type ChatPhase } from "./live-status";
import type { ThreadItem } from "../utils/thread-types";
import type { OfficeAgent } from "@/modules/office/hooks/use-office-agents";

export type ChatThreadProps = {
  items: ThreadItem[];
  agent: OfficeAgent;
  onPickSuggestion?: (text: string) => void;
  phase: ChatPhase;
  phaseHint?: string;
};

const SUGGESTIONS: Array<{ lbl: string; text: string }> = [
  { lbl: "Plan", text: "Help me plan the next change before I start writing code." },
  { lbl: "Review", text: "Look at the current branch and tell me what you'd change before I merge." },
  { lbl: "Inspect", text: "Read ./src and tell me how the code is organised." },
  { lbl: "Explain", text: "Walk me through how this part of the system handles errors." },
];

export function ChatThread({ items, agent, onPickSuggestion, phase, phaseHint }: ChatThreadProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items, phase]);

  return (
    <div className="chat-scroll" ref={ref}>
      {items.length === 0 && phase === "idle" ? (
        <div className="thread-empty">
          <PixelSprite
            agent={agent}
            size={64}
            action={agent.status === "working" ? "typing" : "idle"}
          />
          <div className="greet">
            <h2>Hi, I&apos;m {agent.name}.</h2>
            <p>{agent.description || "Ready when you are — pick a starter or ask anything."}</p>
          </div>
          <div className="sug-grid">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.lbl}
                type="button"
                className="sug"
                onClick={() => onPickSuggestion?.(s.text)}
              >
                <div className="lbl">{s.lbl}</div>
                {s.text}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="chat-thread">
            {items.map((item) => (
              <MessageBubble key={item.id} item={item} agent={agent} />
            ))}
          </div>
          <div
            style={{
              maxWidth: 760,
              margin: "0 auto",
              padding: "0 24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <LiveStatus phase={phase} hint={phaseHint} />
          </div>
        </>
      )}
    </div>
  );
}
