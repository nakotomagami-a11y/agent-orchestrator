"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Portal } from "./portal";
import { Icon } from "./icon";
import { cn } from "@/lib/cn";

export type ModalShellProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Footer slot — usually action buttons. */
  footer?: ReactNode;
  /** Width preset. */
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  /** Drop the default 16px content padding (for tabbed/chat layouts). */
  bareContent?: boolean;
};

const SIZE_PX: Record<NonNullable<ModalShellProps["size"]>, number> = {
  sm: 380,
  md: 560,
  lg: 820,
};

export function ModalShell({
  open,
  onClose,
  title,
  footer,
  size = "md",
  children,
  className,
  closeLabel = "Close",
  bareContent = false,
}: ModalShellProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const previousActive = document.activeElement as HTMLElement | null;
    dialog?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      previousActive?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(20, 14, 12, 0.45)",
          backdropFilter: "blur(2px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          zIndex: 100,
        }}
      >
        <div
          ref={ref}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
          className={cn("card", className)}
          style={{
            width: "100%",
            maxWidth: SIZE_PX[size],
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100vh - 40px)",
            outline: "none",
          }}
        >
          {title ? (
            <div className="card-h">
              <span className="title">{title}</span>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  border: "none",
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  cursor: "pointer",
                  color: "var(--txt-3)",
                }}
              >
                <Icon name="x" />
              </button>
            </div>
          ) : null}
          <div
            style={
              bareContent
                ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }
                : { padding: 16, overflow: "auto" }
            }
          >
            {children}
          </div>
          {footer ? (
            <div
              style={{
                padding: 12,
                borderTop: "1px solid var(--line)",
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}
