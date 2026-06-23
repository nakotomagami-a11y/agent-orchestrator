"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useIsMaximized } from "@/lib/use-is-maximized";

export type GnomeWindowProps = {
  children: ReactNode;
  className?: string;
};

/**
 * The chrome'd app shell. The titlebar is NOT a child of this component -
 * it's rendered as a sibling fixed overlay (see `<Titlebar />`) so it can
 * stack above portal-rendered modals.
 *
 * The first 38px grid row is intentionally empty - it reserves visual space
 * the fixed titlebar overlays. Content fills the remaining row.
 */
export function GnomeWindow({ children, className }: GnomeWindowProps) {
  const maximized = useIsMaximized();

  return (
    <div
      className={cn(
        "absolute bg-bg-1 shadow-[var(--shadow-window)] overflow-hidden grid border border-line-2 [grid-template-rows:38px_1fr] inset-[18px] rounded-[10px] max-[600px]:inset-0 max-[600px]:rounded-none",
        maximized && "inset-0 rounded-none shadow-none border-none",
        className,
      )}
    >
      {/* Empty row reserved for the fixed Titlebar overlay. */}
      <div aria-hidden />
      {children}
    </div>
  );
}
