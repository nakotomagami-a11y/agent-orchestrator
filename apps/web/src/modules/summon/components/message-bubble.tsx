"use client";

import { match } from "ts-pattern";
import { UnitSprite } from "@/components/ui/unit-sprite";
import { ToolCard } from "@/components/ui/tool-card";
import { ThinkingCard } from "@/components/ui/thinking-card";
import { Icon } from "@/components/ui/icon";
import type { OfficeAgent } from "@/modules/office/hooks/use-office-agents";
import type { ThreadItem } from "../utils/thread-types";

export type MessageBubbleProps = {
  item: ThreadItem;
  agent: OfficeAgent;
};

/**
 * Renders a single thread item. Avatars use a stable initial for "you" and the
 * pixel sprite for the agent; hover-reveal actions sit below the bubble.
 */
export function MessageBubble({ item, agent }: MessageBubbleProps) {
  return match(item)
    .with({ kind: "you" }, (it) => (
      <div className="msg you">
        <div className="mav you" aria-hidden>
          P
        </div>
        <div className="bub">
          <div className="who">
            <span className="nm">You</span>
          </div>
          <div className="bubble-prose">{renderProse(it.text)}</div>
          <div className="actions">
            <button type="button" onClick={() => copy(it.text)}>
              <Icon name="copy" size={12} /> Copy
            </button>
          </div>
        </div>
      </div>
    ))
    .with({ kind: "agent-text" }, (it) => (
      <div className="msg">
        <div className="mav" aria-hidden>
          <UnitSprite unit={agent.unitChoice} size={30} animate action="idle" />
        </div>
        <div className="bub">
          <div className="who">
            <span className="nm">{agent.name}</span>
          </div>
          <div className="bubble-prose">
            {renderProse(it.text)}
            {it.streaming ? <span className="cursor" aria-hidden /> : null}
          </div>
          {it.streaming ? null : (
            <div className="actions">
              <button type="button" onClick={() => copy(it.text)}>
                <Icon name="copy" size={12} /> Copy
              </button>
            </div>
          )}
        </div>
      </div>
    ))
    .with({ kind: "agent-tool" }, (it) => (
      <div className="msg">
        <div className="mav" aria-hidden>
          <UnitSprite unit={agent.unitChoice} size={30} animate action="idle" />
        </div>
        <div className="bub" style={{ width: "100%" }}>
          <ToolCard name={it.name} arg={it.arg} />
        </div>
      </div>
    ))
    .with({ kind: "agent-thinking" }, (it) => (
      <div className="msg">
        <div className="mav" aria-hidden>
          <UnitSprite unit={agent.unitChoice} size={30} animate action="idle" />
        </div>
        <div className="bub" style={{ width: "100%" }}>
          <ThinkingCard>{it.text}</ThinkingCard>
        </div>
      </div>
    ))
    .with({ kind: "system-error" }, (it) => (
      <div className="msg">
        <div className="bub" style={{ width: "100%" }}>
          <div
            className="bubble-prose"
            style={{ background: "var(--error)", color: "white", borderColor: "transparent" }}
          >
            <Icon name="x" /> {it.message}
          </div>
        </div>
      </div>
    ))
    .with({ kind: "system-done" }, (it) => (
      <div className="msg">
        <div className="bub" style={{ width: "100%" }}>
          <div className="mmeter">
            <span>run finished</span>
            <span>·</span>
            <span>
              exit <b>{it.exitCode}</b>
            </span>
          </div>
        </div>
      </div>
    ))
    .exhaustive();
}

function copy(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => undefined);
  }
}

/** Light markdown: `**bold**` and `` `code` ``. */
function renderProse(text: string): React.ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) return <b key={i}>{seg.slice(2, -2)}</b>;
    if (seg.startsWith("`") && seg.endsWith("`")) return <code key={i}>{seg.slice(1, -1)}</code>;
    return <span key={i}>{seg}</span>;
  });
}
