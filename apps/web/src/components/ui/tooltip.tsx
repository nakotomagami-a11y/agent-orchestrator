import type { ReactNode, ReactElement, HTMLAttributes } from "react";
import { cloneElement, isValidElement } from "react";

export type TooltipProps = {
  label: string;
  children: ReactNode;
};

/**
 * Lightweight tooltip backed by the native `title` attribute. Sufficient for
 * keyboard + screen-reader access; richer popover-styled tooltips can layer on
 * later without changing the call sites.
 */
export function Tooltip({ label, children }: TooltipProps) {
  if (!isValidElement(children)) return <>{children}</>;
  const child = children as ReactElement<HTMLAttributes<HTMLElement>>;
  const existing = child.props.title;
  return cloneElement(child, { title: existing ? `${existing} — ${label}` : label });
}
