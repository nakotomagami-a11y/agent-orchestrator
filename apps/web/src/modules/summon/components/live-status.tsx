"use client";

export type ChatPhase =
  | "idle"
  | "sending"
  | "connecting"
  | "working"
  | "streaming"
  | "done"
  | "error"
  | "aborted";

export function LiveStatus({ phase, hint }: { phase: ChatPhase; hint?: string }) {
  if (phase === "idle" || phase === "done" || phase === "aborted") return null;

  if (phase === "streaming") {
    return (
      <div className="ao-live-status flex items-center gap-[10px] px-[14px] py-[8px] bg-ao-bg-2 border border-ao-line-1 rounded-full text-[12.5px] text-ao-fg-1 w-fit self-start" role="status" aria-live="polite">
        <span className="ao-led" aria-hidden />
        Typing
        <span className="ao-typing" aria-hidden>
          <span /><span /><span />
        </span>
      </div>
    );
  }

  if (phase === "working") {
    return (
      <div className="ao-live-status flex items-center gap-[10px] px-[14px] py-[8px] bg-ao-bg-2 border border-ao-line-1 rounded-full text-[12.5px] text-ao-fg-1 w-fit self-start" role="status" aria-live="polite">
        <span className="ao-led" aria-hidden />
        {hint ? (
          <>
            Using
            <span className="font-mono text-[11.5px] text-ao-fg-2 px-[6px] py-[1px] bg-ao-bg-3 border border-ao-line-1 rounded-[4px] max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap">{hint}</span>
          </>
        ) : (
          <>
            Working
            <span className="ao-typing" aria-hidden>
              <span /><span /><span />
            </span>
          </>
        )}
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div
        className="ao-live-status flex items-center gap-[10px] px-[14px] py-[8px] bg-ao-bg-2 border border-[rgba(217,83,79,0.3)] rounded-full text-[12.5px] text-ao-fg-1 w-fit self-start"
        role="status"
        aria-live="polite"
      >
        <span className="ao-led bg-[var(--ao-bad)] shadow-none" aria-hidden />
        <span className="text-[var(--ao-bad)]">{hint ? `Error: ${hint}` : "Run failed"}</span>
      </div>
    );
  }

  // sending / connecting
  return (
    <div className="ao-live-status flex items-center gap-[10px] px-[14px] py-[8px] bg-ao-bg-2 border border-ao-line-1 rounded-full text-[12.5px] text-ao-fg-1 w-fit self-start" role="status" aria-live="polite">
      <span className="ao-led" aria-hidden />
      {phase === "connecting" ? "Connecting…" : "Sending…"}
    </div>
  );
}
