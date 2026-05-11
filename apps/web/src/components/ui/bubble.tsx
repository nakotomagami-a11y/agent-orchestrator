import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BubbleVariant = "working" | "thinking" | "done";

export type BubbleProps = HTMLAttributes<HTMLDivElement> & {
  /** Visual variant — drives colour + dot animation via globals.css */
  variant?: BubbleVariant;
  /** Hide the leading status dot. */
  hideDot?: boolean;
  children: ReactNode;
};

/**
 * Speech bubble used over desks in the iso office (and reusable wherever a
 * floating annotation is needed). Position is the caller's job — this component
 * only owns visual styling.
 */
export function Bubble({
  variant = "working",
  hideDot = false,
  className,
  children,
  ...rest
}: BubbleProps) {
  return (
    <div className={cn("bubble", variant, className)} {...rest}>
      {hideDot ? null : <span className="dot" aria-hidden />}
      <span>{children}</span>
    </div>
  );
}
