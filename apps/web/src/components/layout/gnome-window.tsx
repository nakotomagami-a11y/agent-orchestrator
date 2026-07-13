"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useIsMaximized } from "@/lib/use-is-maximized";

export type GnomeWindowProps = {
  children: ReactNode;
  className?: string;
};

/**
 * The app shell. Titlebar is NOT a child — it's rendered as a sibling fixed
 * overlay (see `<Titlebar />`) so it can stack above portal-rendered modals.
 *
 * Edge-to-edge in every mode: no border, no rounded corners, no shadow, no
 * chrome inset. The old "floating GNOME window" chrome (18px transparent
 * inset with a shadow) left a light-color ring around the app that leaked
 * whichever background lived behind it — the user asked for it removed.
 * `maximized` is preserved as a hook consumer contract but no longer flips
 * any styles.
 */
export function GnomeWindow({ children, className }: GnomeWindowProps) {
  useIsMaximized();

  return (
    <div
      className={cn(
        "gnome-window absolute inset-0 bg-bg-1 overflow-hidden flex flex-col",
        className,
      )}
    >
      {/* Empty 38px row reserved for the fixed Titlebar overlay. */}
      <div className="h-[38px] shrink-0" aria-hidden />
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}
