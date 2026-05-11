"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UnitSprite } from "@/components/ui/unit-sprite";
import { ToolCard } from "@/components/ui/tool-card";
import { ToolChainCard } from "@/components/ui/tool-chain-card";
import { Icon } from "@/components/ui/icon";
import { MessageBubble } from "./message-bubble";
import { LiveStatus, type ChatPhase } from "./live-status";
import type { ThreadItem } from "../utils/thread-types";
import type { OfficeAgent } from "@/modules/office/hooks/use-office-agents";

const LIVE_PHASES = new Set<ChatPhase>(["sending", "connecting", "working", "streaming"]);

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
          <UnitSprite
            unit={agent.unitChoice}
            size={72}
            action={agent.status === "working" ? "working" : "idle"}
            animate
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
          {hiddenCount > 0 ? (
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
                aria-label={t("load_earlier_aria", { count: hiddenCount })}
              >
                <span style={{ display: "inline-flex", transform: "rotate(180deg)" }} aria-hidden>
                  <Icon name="chevron-down" size={12} />
                </span>
                {t("load_earlier", { count: hiddenCount })}
              </button>
            </div>
          ) : null}
          <div className="chat-thread">
            {rows.map((row, idx) => {
              if (row.kind === "single") {
                return <MessageBubble key={row.item.id} item={row.item} agent={agent} />;
              }
              const isTail = idx === rows.length - 1;
              const live = isTail && LIVE_PHASES.has(phase);
              return (
                <div key={row.id} className="msg">
                  <div className="tool-chain" style={{ width: "100%" }}>
                    <div className="mav" aria-hidden>
                      <UnitSprite unit={agent.unitChoice} size={30} animate action="idle" />
                    </div>
                    <div className="tc-list" aria-label={`${row.tools.length} tool calls`}>
                      {row.tools.length === 1 ? (
                        // Singletons stay flat — no point wrapping one call in
                        // a chain disclosure.
                        <ToolCard name={row.tools[0]!.name} arg={row.tools[0]!.arg} />
                      ) : (
                        <ToolChainCard
                          items={row.tools.map((t) => ({ id: t.id, name: t.name, arg: t.arg }))}
                          live={live}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              maxWidth: 760,
              margin: "0 auto",
              padding: "0 8px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <LiveStatus phase={phase} hint={phaseHint} />
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
