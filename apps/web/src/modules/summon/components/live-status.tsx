"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";

export type ChatPhase =
  | "idle"
  | "sending"
  | "connecting"
  | "working"
  | "streaming"
  | "done"
  | "error"
  | "aborted";

const TONE: Record<ChatPhase, "info" | "warn" | "ok" | "err" | "ghost"> = {
  idle: "ghost",
  sending: "info",
  connecting: "info",
  working: "warn",
  streaming: "info",
  done: "ok",
  error: "err",
  aborted: "ghost",
};

const TONE_COLOUR: Record<"info" | "warn" | "ok" | "err" | "ghost", string> = {
  info: "var(--acc)",
  warn: "var(--queued)",
  ok: "var(--done)",
  err: "var(--error)",
  ghost: "var(--txt-3)",
};

/**
 * In-thread status bubble — sits at the bottom of the chat scroll area and
 * shows what the run is doing right now. Renders nothing when the phase is
 * `done` and there's text in the thread (so the row doesn't linger forever);
 * surfaces `error` and `aborted` so the user knows nothing else is coming.
 */
export function LiveStatus({
  phase,
  hint,
}: {
  phase: ChatPhase;
  hint?: string;
}) {
  const t = useTranslations();
  if (phase === "idle") return null;
  const tone = TONE[phase];
  const label = t(`live_status.${phase}`);
  const colour = TONE_COLOUR[tone];
  const active = phase === "sending" || phase === "connecting" || phase === "working" || phase === "streaming";
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        margin: "8px 24px 14px",
        padding: "6px 10px 6px 8px",
        borderRadius: 999,
        background: "var(--bg-2)",
        border: `1px solid ${active ? "var(--line-2)" : "var(--line)"}`,
        fontFamily: "var(--font-mono)",
        fontSize: 11.5,
        color: "var(--txt-2)",
        alignSelf: "flex-start",
        boxShadow: "var(--shadow-1)",
      }}
    >
      <PhaseDot tone={tone} active={active} />
      <span style={{ color: tone === "err" ? colour : "var(--txt)" }}>{label}</span>
      {hint ? <span style={{ color: "var(--txt-3)" }}>· {hint}</span> : null}
      {phase === "error" || phase === "aborted" ? <Icon name="x" size={11} /> : null}
      {phase === "done" ? <Icon name="copy" size={11} style={{ color: "var(--done)" }} /> : null}
    </div>
  );
}

function PhaseDot({ tone, active }: { tone: keyof typeof TONE_COLOUR; active: boolean }) {
  const colour = TONE_COLOUR[tone];
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: colour,
        boxShadow: active ? `0 0 0 3px ${colour}33` : "none",
        animation: active ? "pulseDot 1.4s infinite ease-in-out" : "none",
        flex: "0 0 8px",
      }}
    />
  );
}
