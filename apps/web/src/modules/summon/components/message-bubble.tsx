"use client";

import { match } from "ts-pattern";
import { ToolCard } from "@/components/ui/tool-card";
import { ThinkingCard } from "@/components/ui/thinking-card";
import { Icon } from "@/components/ui/icon";
import type { ThreadItem } from "../utils/thread-types";

export type MessageBubbleProps = {
  item: ThreadItem;
  agentName: string;
};

/**
 * Renders a single thread item. ts-pattern fans the discriminated union out
 * into per-variant JSX without runtime branching helpers.
 */
export function MessageBubble({ item, agentName }: MessageBubbleProps) {
  return match(item)
    .with({ kind: "you" }, (it) => (
      <div className="msg you">
        <div className="mav you" aria-hidden>
          You
        </div>
        <div className="bub">
          <div className="who">
            <span className="nm">You</span>
          </div>
          <div className="bubble-prose">{it.text}</div>
        </div>
      </div>
    ))
    .with({ kind: "agent-text" }, (it) => (
      <div className="msg">
        <div className="mav" aria-hidden style={{ background: "var(--bg-2)" }} />
        <div className="bub">
          <div className="who">
            <span className="nm">{agentName}</span>
          </div>
          <div className="bubble-prose">
            {it.text}
            {it.streaming ? <span className="cursor" aria-hidden /> : null}
          </div>
        </div>
      </div>
    ))
    .with({ kind: "agent-tool" }, (it) => (
      <div className="msg">
        <div className="mav" aria-hidden style={{ background: "var(--bg-2)" }} />
        <div className="bub" style={{ width: "100%" }}>
          <ToolCard name={it.name} arg={it.arg} />
        </div>
      </div>
    ))
    .with({ kind: "agent-thinking" }, (it) => (
      <div className="msg">
        <div className="mav" aria-hidden style={{ background: "var(--bg-2)" }} />
        <div className="bub" style={{ width: "100%" }}>
          <ThinkingCard>{it.text}</ThinkingCard>
        </div>
      </div>
    ))
    .with({ kind: "system-error" }, (it) => (
      <div className="msg">
        <div className="bub" style={{ width: "100%" }}>
          <div className="bubble-prose" style={{ background: "var(--error)", color: "white", borderColor: "transparent" }}>
            <Icon name="x" /> {it.message}
          </div>
        </div>
      </div>
    ))
    .with({ kind: "system-done" }, (it) => (
      <div className="msg">
        <div className="bub" style={{ width: "100%", color: "var(--txt-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          run finished · exit {it.exitCode}
        </div>
      </div>
    ))
    .exhaustive();
}
