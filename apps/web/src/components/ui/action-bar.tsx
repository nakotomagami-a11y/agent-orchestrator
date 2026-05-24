"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export type ActionBarAction = {
  key: string;
  element: ReactNode;
};

/**
 * Renders actions inline when the parent flex row has space; collapses to a
 * "⋯" dropdown when the row overflows. Wrap only the actions that should
 * participate in the collapse — fixed buttons (like "Add agent") stay outside.
 *
 * The wrapper has flex-shrink:0 so the parent overflows rather than squishing
 * the buttons; we measure parent.scrollWidth > parent.clientWidth to detect
 * that overflow and switch to collapsed mode.
 */
export function ActionBar({ actions }: { actions: ActionBarAction[] }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  // Track collapse state in a ref so the ResizeObserver callback is never stale
  const stateRef = useRef({ collapsed: false, collapseWidth: null as number | null });
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  const runCheck = () => {
    const el = wrapperRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const { collapsed: isCollapsed, collapseWidth } = stateRef.current;

    if (!isCollapsed) {
      if (parent.scrollWidth > parent.clientWidth + 2) {
        // Record the full row width at the moment it overflows so we know
        // exactly how wide the parent needs to be before we expand again.
        stateRef.current.collapseWidth = parent.scrollWidth;
        stateRef.current.collapsed = true;
        setCollapsed(true);
      }
    } else {
      // Only expand once the parent is clearly wider than the full row was
      // when it overflowed (adding a 4px hysteresis buffer to avoid flicker).
      if (collapseWidth !== null && parent.clientWidth > collapseWidth + 4) {
        stateRef.current.collapsed = false;
        stateRef.current.collapseWidth = null;
        setCollapsed(false);
      }
    }
  };

  // Run after every render to catch async content changes (e.g. BuildButton
  // returning null at first then showing after a fetch).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { runCheck(); });

  // ResizeObserver on the parent handles window-resize events.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(runCheck);
    observer.observe(parent);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the overflow dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={wrapperRef} className="shrink-0 flex items-center gap-2">
      {collapsed ? (
        <div ref={dropRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-[8px] border border-transparent text-txt-2 transition-[background,border-color,color] duration-[120ms] hover:bg-bg-2 hover:border-line hover:text-txt",
              open && "bg-bg-2 border-line text-txt",
            )}
            title="More actions"
          >
            <Icon name="more-horizontal" size={16} />
          </button>

          {open && (
            <div className="absolute top-[calc(100%+6px)] right-0 min-w-[200px] bg-[var(--bg-elev)] border border-[var(--line-2)] rounded-[10px] shadow-[var(--shadow-3)] z-50 py-1 overflow-hidden">
              {actions.map((a) => (
                <div key={a.key} className="px-1.5 py-0.5 flex">
                  {a.element}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {actions.map((a) => a.element)}
        </>
      )}
    </div>
  );
}
