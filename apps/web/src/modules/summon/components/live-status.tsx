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
      <div className="ao-live-status" role="status" aria-live="polite">
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
      <div className="ao-live-status" role="status" aria-live="polite">
        <span className="ao-led" aria-hidden />
        {hint ? (
          <>
            Using
            <span className="ao-tool-arg">{hint}</span>
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
        className="ao-live-status"
        style={{ borderColor: "rgba(217,83,79,0.3)" }}
        role="status"
        aria-live="polite"
      >
        <span className="ao-led" style={{ background: "var(--ao-bad)", boxShadow: "none" }} aria-hidden />
        <span style={{ color: "var(--ao-bad)" }}>{hint ? `Error: ${hint}` : "Run failed"}</span>
      </div>
    );
  }

  // sending / connecting
  return (
    <div className="ao-live-status" role="status" aria-live="polite">
      <span className="ao-led" aria-hidden />
      {phase === "connecting" ? "Connecting…" : "Sending…"}
    </div>
  );
}
