import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
};

/**
 * `.badge` lives inside `.nav-item` in globals.css — the parent's `.on` state
 * recolors the badge automatically. Keep this primitive logic-free; counts and
 * formatting come from the caller.
 */
export function Badge({ children, className, ...rest }: BadgeProps) {
  return (
    <span className={cn("badge", className)} {...rest}>
      {children}
    </span>
  );
}
