import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { getStatusMeta, type AgentStatus } from "./status-dot.utils";

export type PipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Drives the colour of the leading dot. */
  status?: AgentStatus;
  /** Primary label (agent short-name). */
  label: ReactNode;
  /** Secondary line (mono, dimmed) — typically truncated task text. */
  hint?: ReactNode;
};

/**
 * `.pip` — chip used in the active-agents strip at the bottom of the office.
 * Rendered as a `<button>` so it's keyboard-reachable; the parent passes the
 * onClick handler.
 */
export const Pip = forwardRef<HTMLButtonElement, PipProps>(function Pip(
  { status = "working", label, hint, className, type = "button", ...rest },
  ref,
) {
  const meta = getStatusMeta(status);
  const dotStyle: CSSProperties = { background: meta.color };

  return (
    <button
      ref={ref}
      type={type}
      className={cn("pip", className)}
      {...rest}
    >
      <span className="pdot" style={dotStyle} aria-hidden />
      <span>{label}</span>
      {hint ? (
        <span
          style={{
            color: "var(--txt-3)",
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
          }}
        >
          {hint}
        </span>
      ) : null}
    </button>
  );
});
