"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { MessageBubble, ToolGroupRow } from "./message-bubble";
import { LiveStatus, type ChatPhase } from "./live-status";
import type { ThreadItem } from "../utils/thread-types";
import type { OfficeAgent } from "@/modules/office/hooks/use-office-agents";

const LIVE_PHASES = new Set<ChatPhase>(["sending", "connecting", "working", "streaming"]);
const CONVERSATIONAL_KINDS = new Set<string>(["you", "agent-text", "system-done", "system-error", "agent-subagent"]);

/** How many items to render at first. The transcript may hold thousands;
 *  rendering the whole list on every token would be a frame-drop nightmare. */
const VISIBLE_WINDOW = 50;
/** How many additional older items to surface when the user clicks "Load
 *  earlier". Tuned so the first paint after a click stays under a frame
 *  budget even on a low-end laptop. */
const LOAD_MORE_STEP = 50;
/** Distance from the bottom (in CSS px) that still counts as "near bottom".
 *  While the user is inside this band, the thread keeps auto-scrolling on
 *  new tokens; once they scroll above it, auto-follow is paused. */
const STICK_THRESHOLD_PX = 80;

/** Either a single thread item or a consecutive run of agent-tool calls.
 *  Grouping happens at the thread layer so a chain of tool invocations reads
 *  as one rail with a single avatar, not N independent messages. */
type RenderRow =
  | { kind: "single"; item: ThreadItem }
  | { kind: "tool-chain"; id: string; tools: Array<Extract<ThreadItem, { kind: "agent-tool" }>> };

function looksLikeQuestion(text: string): boolean {
  const nonEmpty = text.split("\n").filter((l) => l.trim());
  return nonEmpty.slice(-5).some((l) => l.trimEnd().endsWith("?"));
}

function groupRows(items: ThreadItem[]): RenderRow[] {
  const rows: RenderRow[] = [];
  for (const item of items) {
    const prev = rows[rows.length - 1];
    if (item.kind === "agent-tool" && prev?.kind === "tool-chain") {
      prev.tools.push(item);
      continue;
    }
    if (item.kind === "agent-tool") {
      rows.push({ kind: "tool-chain", id: `chain-${item.id}`, tools: [item] });
      continue;
    }
    rows.push({ kind: "single", item });
  }
  return rows;
}

export type ChatThreadProps = {
  items: ThreadItem[];
  agent: OfficeAgent;
  onPickSuggestion?: (text: string) => void;
  /** Direct submit — used by inline clarify reply. */
  onSubmit?: (text: string) => void;
  phase: ChatPhase;
  phaseHint?: string;
  phaseStats?: string;
  /** Message queued while agent is running — rendered as a pending bubble at the bottom. */
  queuedMessage?: string | null;
  onCancelQueue?: () => void;
};

const SUGGESTIONS: Array<{ lbl: string; text: string }> = [
  { lbl: "Plan", text: "Help me plan the next change before I start writing code." },
  { lbl: "Review", text: "Look at the current branch and tell me what you'd change before I merge." },
  { lbl: "Inspect", text: "Read ./src and tell me how the code is organised." },
  { lbl: "Explain", text: "Walk me through how this part of the system handles errors." },
];

export function ChatThread({ items, agent, onPickSuggestion, onSubmit, phase, phaseHint, phaseStats, queuedMessage, onCancelQueue }: ChatThreadProps) {
  const t = useTranslations("chat_thread");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  // ── Auto-follow state ──
  // `followTail` is the user's intent: "keep me pinned to the latest message".
  // We flip it to false the moment they scroll above the stick band, and back
  // to true the moment they return to it. While following, every new item
  // triggers a scroll-to-bottom; while not following, new tokens leave the
  // viewport alone — exactly what the user asked for.
  const [followTail, setFollowTail] = useState(true);
  // `hasNewBelow` drives the "Jump to latest" pill. True when items arrive
  // while the user is scrolled up; cleared when they jump back down (or
  // scroll back into the stick band themselves).
  const [hasNewBelow, setHasNewBelow] = useState(false);
  // `visibleCount` is the windowed render slice. Starts at the most recent
  // VISIBLE_WINDOW items; user clicks "Load earlier" to widen the window.
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(items.length, VISIBLE_WINDOW),
  );

  // When the underlying transcript identity changes (agent / instance switch,
  // /clear, /branch), reset the visible window AND snap back to the latest
  // message so we open at the bottom of the new conversation — never midway.
  // We detect a swap via the id of items[0]: appending tokens never changes
  // it, but loading a different transcript always does.
  const firstId = items[0]?.id ?? null;
  const prevFirstIdRef = useRef(firstId);
  useLayoutEffect(() => {
    if (prevFirstIdRef.current === firstId) return;
    prevFirstIdRef.current = firstId;
    setVisibleCount(Math.min(items.length, VISIBLE_WINDOW));
    setFollowTail(true);
    setHasNewBelow(false);
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [firstId, items.length]);

  // Slice the tail of the transcript for rendering.
  const visibleItems = useMemo(() => {
    if (visibleCount >= items.length) return items;
    return items.slice(items.length - visibleCount);
  }, [items, visibleCount]);

  const rows = useMemo(() => groupRows(visibleItems), [visibleItems]);
  const hiddenCount = items.length - visibleItems.length;
  const hiddenConversationalCount = hiddenCount > 0
    ? items.slice(0, hiddenCount).filter((it) => CONVERSATIONAL_KINDS.has(it.kind)).length
    : 0;

  // Detect agent-text items that are asking a question and haven't been
  // replied to yet. Conditions: any of the last 5 non-empty lines ends with
  // '?', immediately followed by system-done(exit 0), and no 'you' item
  // appears after that system-done.
  const questionIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < items.length - 1; i++) {
      const item = items[i]!;
      const next = items[i + 1]!;
      if (
        item.kind === "agent-text" &&
        !item.streaming &&
        looksLikeQuestion(item.text) &&
        next.kind === "system-done" &&
        next.exitCode === 0 &&
        !items.slice(i + 2).some((it) => it.kind === "you")
      ) {
        ids.add(item.id);
      }
    }
    return ids;
  }, [items]);

  // ── Scroll listener: keep `followTail` in sync with the user's position ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        const nearBottom = distance <= STICK_THRESHOLD_PX;
        setFollowTail(nearBottom);
        if (nearBottom) setHasNewBelow(false);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  // ── On mount, snap to the bottom. The modal opens at the latest message,
  //    always — no smooth scroll, no animation, just instantly there. ──
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setFollowTail(true);
    setHasNewBelow(false);
    // Run exactly once per mount. The thread state is owned by the parent,
    // and re-running on items changes is the auto-scroll bug we're fixing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── New content effect ──
  // We track the previous item count to distinguish "appended content"
  // (token streamed in, new turn) from "user clicked Load earlier" (item
  // count also rose, but at the top — we must NOT scroll to bottom in that
  // case). When the count rises and the diff matches the bottom of the
  // list, we're in append-mode.
  const prevLenRef = useRef(items.length);
  useEffect(() => {
    const prevLen = prevLenRef.current;
    const nextLen = items.length;
    prevLenRef.current = nextLen;
    if (nextLen <= prevLen) return; // shrinkage or no change → ignore

    const el = scrollRef.current;
    if (!el) return;
    if (followTail) {
      // Stick-to-bottom. Use scrollIntoView on a sentinel so we don't fight
      // with content height changes mid-token.
      bottomAnchorRef.current?.scrollIntoView({ block: "end" });
    } else {
      setHasNewBelow(true);
    }
  }, [items.length, followTail]);

  // ── Load earlier: expand the visible window, preserving scroll anchor ──
  // Naively bumping visibleCount would prepend nodes and yank the viewport
  // upward. We capture scrollHeight before the update and restore the
  // delta after paint so the user's reading position stays put.
  const loadEarlier = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setVisibleCount((c) => Math.min(items.length, c + LOAD_MORE_STEP));
      return;
    }
    const prevHeight = el.scrollHeight;
    const prevTop = el.scrollTop;
    setVisibleCount((c) => Math.min(items.length, c + LOAD_MORE_STEP));
    // After paint, adjust scrollTop by the height delta.
    requestAnimationFrame(() => {
      const nextHeight = el.scrollHeight;
      el.scrollTop = prevTop + (nextHeight - prevHeight);
    });
  }, [items.length]);

  const jumpToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setFollowTail(true);
    setHasNewBelow(false);
  }, []);

  return (
    <div className="chat-scroll" ref={scrollRef}>
      {items.length === 0 && phase === "idle" ? (
        <div className="thread-empty">
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "var(--ao-bg-3)",
              border: "1px solid var(--ao-line-1)",
              display: "grid",
              placeItems: "center",
              fontSize: 36,
              fontWeight: 700,
              color: "var(--ao-fg-1)",
              boxShadow: "0 8px 30px -12px rgba(0,0,0,0.5)",
              flexShrink: 0,
            }}
            aria-hidden
          >
            {agent.short[0]?.toUpperCase() ?? "?"}
          </div>
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
          {hiddenConversationalCount > 0 ? (
            <div
              style={{
                maxWidth: 760,
                margin: "0 auto 12px",
                padding: "0 8px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                className="btn sm ghost"
                onClick={loadEarlier}
                aria-label={t("load_earlier_aria", { count: hiddenConversationalCount })}
              >
                <span style={{ display: "inline-flex", transform: "rotate(180deg)" }} aria-hidden>
                  <Icon name="chevron-down" size={12} />
                </span>
                {t("load_earlier", { count: hiddenConversationalCount })}
              </button>
            </div>
          ) : null}
          <div className="chat-thread">
            {rows.map((row, idx) => {
              if (row.kind === "single") {
                const isQuestion = questionIds.has(row.item.id);
                return (
                  <MessageBubble
                    key={row.item.id}
                    item={row.item}
                    agent={agent}
                    isQuestion={isQuestion}
                    onReply={isQuestion && onSubmit ? onSubmit : undefined}
                    onRerun={row.item.kind === "you" && onSubmit ? onSubmit : undefined}
                  />
                );
              }
              const isTail = idx === rows.length - 1;
              const running = isTail && LIVE_PHASES.has(phase);
              return (
                <ToolGroupRow
                  key={row.id}
                  tools={row.tools.map((t) => ({ id: t.id, name: t.name, arg: t.arg }))}
                  avatar={agent.short[0]?.toUpperCase() ?? "?"}
                  running={running}
                />
              );
            })}
          </div>
          {queuedMessage ? (
            <div className="ao-msg ao-user ao-msg-queued">
              <div className="ao-av ao-you" aria-hidden>P</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <div className="ao-bubble ao-bubble-queued">{queuedMessage}</div>
                <div className="ao-queued-row">
                  <span className="ao-queued-pill">queued</span>
                  <button
                    type="button"
                    className="ao-queued-cancel"
                    onClick={onCancelQueue}
                    aria-label="Cancel queued message"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <div
            style={{
              maxWidth: 760,
              margin: "0 auto",
              padding: "0 8px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <LiveStatus phase={phase} hint={phaseHint} />
            {phaseStats && phase !== "idle" && phase !== "done" && phase !== "aborted" && (
              <span className="ao-phase-stats">{phaseStats}</span>
            )}
          </div>
          {/* Sentinel for the stick-to-bottom scroll anchor. Lives at the
              very end of the scroll container so scrollIntoView({block:"end"})
              lands precisely where we want, regardless of LiveStatus height. */}
          <div ref={bottomAnchorRef} aria-hidden style={{ height: 1 }} />
          {hasNewBelow && !followTail ? (
            <div className="chat-jump-latest-wrap" aria-live="polite">
              <button
                type="button"
                className="chat-jump-latest"
                onClick={jumpToBottom}
                aria-label={t("jump_to_latest_aria")}
              >
                <Icon name="chevron-down" size={12} />
                {t("jump_to_latest")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
