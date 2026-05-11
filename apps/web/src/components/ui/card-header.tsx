import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type CardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  /** Secondary text (mono, muted) shown next to the title. */
  sub?: ReactNode;
  /** Right-aligned slot for actions, buttons, etc. */
  right?: ReactNode;
};

/**
 * `.card-h` — title + optional sub + optional right-side action slot.
 * Mirrors v3 markup exactly so the existing CSS adopts it without changes.
 */
export function CardHeader({
  title,
  sub,
  right,
  className,
  ...rest
}: CardHeaderProps) {
  return (
    <div className={cn("card-h", className)} {...rest}>
      <span className="title">{title}</span>
      {sub ? <span className="sub">{sub}</span> : null}
      {right ? <div className="card-h-right">{right}</div> : null}
    </div>
  );
}
