import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type GnomeWindowProps = {
  titlebar: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Outer GNOME window chrome. The whole app lives inside it. Renders the
 * `.gnome-window` grid (38px titlebar row + 1fr body row). Expects a single
 * `children` body — the inner sidebar/main split is the layout's responsibility.
 */
export function GnomeWindow({ titlebar, children, className }: GnomeWindowProps) {
  return (
    <div className={cn("gnome-window", className)}>
      {titlebar}
      {children}
    </div>
  );
}
