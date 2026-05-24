"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
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

function isAgentRow(row: RenderRow): boolean {
  if (row.kind === "tool-chain") return true;
  const k = row.item.kind;
  return k === "agent-text" || k === "agent-tool" || k === "agent-thinking" || k === "agent-subagent";
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
  /** Direct submit - used by inline clarify reply. */
  onSubmit?: (text: string) => void;
  phase: ChatPhase;
  phaseHint?: string;
  phaseStats?: string;
  /** Message queued while agent is running - rendered as a pending bubble at the bottom. */
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
  // viewport alone - exactly what the user asked for.
  const [followTail, setFollowTail] = useState(true);
  // `hasNewBelow` drives the "Jump to latest" pill. True when items arrive
  // while the user is scrolled up; cleared when they jump back down (or
  // scroll back into the stick band themselves).
  const [hasNewBelow, setHasNewBelow] = useState(false);
  // `visibleCount` is the windowed render slice. Starts at the most recent
  // VISIBLE_WINDOW items; user clicks "Load earlier" to widen the window.
  const [visibleCount, setVisibleCount] = useState(VISIBLE_WINDOW);

  // When the underlying transcript identity changes (agent / instance switch,
  // /clear, /branch), reset the visible window AND snap back to the latest
  // message so we open at the bottom of the new conversation - never midway.
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
  //    always - no smooth scroll, no animation, just instantly there. ──
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
  // count also rose, but at the top - we must NOT scroll to bottom in that
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
    <div className="relative min-h-0 flex-1 overflow-hidden flex flex-col">
    <div className="overflow-y-auto overscroll-contain px-[16px] pt-[18px] pb-[20px] flex-1" ref={scrollRef}>
      {items.length === 0 && phase === "idle" ? (
        <div className="text-center flex flex-col gap-[20px] items-center max-w-[760px] mx-auto mt-[60px] px-[24px]">
          <div
            className="w-[72px] h-[72px] rounded-[16px] bg-[var(--ao-bg-3)] border border-[var(--ao-line-1)] grid place-items-center text-[36px] font-bold text-[var(--ao-fg-1)] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] shrink-0"
            aria-hidden
          >
            {agent.short[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <h2 className="font-bold mt-[6px] mb-[4px] text-[22px] tracking-[-0.02em]">Hi, I&apos;m {agent.name}.</h2>
            <p className="text-[var(--txt-3)] m-0 text-[13px]">{agent.description || "Ready when you are - pick a starter or ask anything."}</p>
          </div>
          <div className="grid gap-2 grid-cols-2 w-full mt-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.lbl}
                type="button"
                className="text-left cursor-pointer bg-[var(--bg-1)] border border-[var(--line)] text-[var(--txt-2)] rounded-[12px] px-[14px] py-3 text-[13px] transition-all duration-[120ms] hover:border-[var(--acc)] hover:text-[var(--txt)] hover:-translate-y-px hover:shadow-[var(--shadow-1)]"
                onClick={() => onPickSuggestion?.(s.text)}
              >
                <div className="text-[var(--acc)] uppercase font-semibold text-[10.5px] font-[var(--font-mono)] tracking-[0.06em] mb-1">{s.lbl}</div>
                {s.text}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {hiddenConversationalCount > 0 ? (
            <div className="max-w-[760px] mx-auto mb-3 px-2 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadEarlier}
                aria-label={t("load_earlier_aria", { count: hiddenConversationalCount })}
              >
                <span className="inline-flex rotate-180" aria-hidden>
                  <Icon name="chevron-down" size={12} />
                </span>
                {t("load_earlier", { count: hiddenConversationalCount })}
              </Button>
            </div>
          ) : null}
          <div className="max-w-[760px] mx-auto px-2 flex flex-col gap-[20px]">
            {rows.map((row, idx) => {
              const prevRow = rows[idx - 1] ?? null;
              const curIsAgent = isAgentRow(row);
              const hideAvatar = curIsAgent && prevRow !== null && isAgentRow(prevRow);

              if (row.kind === "single") {
                const isQuestion = questionIds.has(row.item.id);
                const lastYouText = row.item.kind === "system-error" && onSubmit
                  ? (items.slice(0, items.indexOf(row.item)).reverse().find(it => it.kind === "you") as { kind: "you"; text: string } | undefined)?.text
                  : undefined;
                return (
                  <MessageBubble
                    key={row.item.id}
                    item={row.item}
                    agent={agent}
                    isQuestion={isQuestion}
                    hideAvatar={hideAvatar}
                    onReply={isQuestion && onSubmit ? onSubmit : undefined}
                    onRerun={row.item.kind === "you" && onSubmit ? onSubmit : undefined}
                    onRetry={lastYouText ? () => onSubmit!(lastYouText) : undefined}
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
                  hideAvatar={hideAvatar}
                  running={running}
                />
              );
            })}
          </div>
          {queuedMessage ? (
            <div className="max-w-[760px] mx-auto px-2 mt-5">
            <div className="flex flex-row-reverse ml-auto w-fit max-w-[80%] gap-[12px] relative opacity-[0.55]">
              <div className="w-[30px] h-[30px] rounded-full shrink-0 grid place-items-center font-bold text-[12px] text-white border border-white/[0.08] bg-[linear-gradient(135deg,#d6336c_0%,#b21e5d_100%)] font-[var(--ao-font-sans)]" aria-hidden>P</div>
              <div className="flex flex-col items-end gap-[6px]">
                <div className="bg-ao-bg-3 border border-dashed border-ao-line-1 rounded-[14px_14px_4px_14px] px-4 py-3 text-[14px] leading-[1.55] text-ao-fg-0">{queuedMessage}</div>
                <div className="flex items-center gap-[6px]">
                  <span className="font-mono text-[10px] tracking-[0.06em] uppercase text-ao-fg-3 bg-ao-bg-3 border border-ao-line-1 rounded-full px-[7px] py-[1px]">queued</span>
                  <button
                    type="button"
                    className="w-4 h-4 rounded-full bg-transparent border border-ao-line-1 text-ao-fg-3 text-[12px] leading-none cursor-pointer grid place-items-center p-0 hover:bg-ao-bg-3 hover:text-ao-fg-1"
                    onClick={onCancelQueue}
                    aria-label="Cancel queued message"
                  >×</button>
                </div>
              </div>
            </div>
            </div>
          ) : null}
          <div className="max-w-[760px] mx-auto px-2 pb-4 flex items-center gap-3">
            <LiveStatus phase={phase} hint={phaseHint} />
            {phaseStats && phase !== "idle" && phase !== "done" && phase !== "aborted" && (
              <span className="font-mono text-[11.5px] text-ao-fg-3 whitespace-nowrap shrink-0">{phaseStats}</span>
            )}
          </div>
          {/* Sentinel for the stick-to-bottom scroll anchor. Lives at the
              very end of the scroll container so scrollIntoView({block:"end"})
              lands precisely where we want, regardless of LiveStatus height. */}
          <div ref={bottomAnchorRef} aria-hidden className="h-px" />
        </>
      )}
    </div>
    {!followTail ? (
      <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-[2]" aria-live="polite">
        <button
          type="button"
          className="pointer-events-auto inline-flex items-center gap-[5px] py-[7px] pl-[12px] pr-[14px] rounded-full border border-[var(--line)] bg-[var(--bg-1)] text-[var(--txt)] text-[12px] font-medium tracking-[0.01em] shadow-[var(--shadow-1)] cursor-pointer animate-[jump-pill-in_140ms_ease_both] transition-[color,background,border-color,box-shadow] duration-[100ms] hover:shadow-[var(--shadow-2)] focus-visible:outline-2 focus-visible:outline-[var(--acc)] focus-visible:outline-offset-2"
          data-new={hasNewBelow}
          onClick={jumpToBottom}
          aria-label={t("jump_to_latest_aria")}
        >
          <Icon name="chevron-down" size={14} />
          {hasNewBelow ? t("jump_to_latest") : t("scroll_to_bottom")}
        </button>
      </div>
    ) : null}
    </div>
  );
}
