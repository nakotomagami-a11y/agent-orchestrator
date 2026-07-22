"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Portal } from "@/components/ui/portal";
import { cn } from "@/lib/cn";

export type DropdownItem = {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

export type DropdownMenuProps = {
  trigger: ReactNode;
  items: DropdownItem[];
  ariaLabel?: string;
  align?: "start" | "end";
  triggerClassName?: string;
};

export function DropdownMenu({ trigger, items, ariaLabel, align = "end", triggerClassName }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [style, setStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // Portalled to <body> (see Tooltip for the same pattern) so the menu can
  // escape ancestors with `overflow-hidden` — e.g. the project hero card —
  // instead of being clipped by them.
  useEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setStyle({
      position: "fixed",
      top: rect.bottom + 4,
      ...(align === "end" ? { right: window.innerWidth - rect.right } : { left: rect.left }),
    });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[activeIndex];
      if (item && !item.disabled) {
        item.onSelect();
        setOpen(false);
      }
    }
  };

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "h-[24px] px-[10px] inline-flex items-center gap-[6px] bg-transparent border border-transparent rounded-sm text-txt-2 font-[inherit] text-[12.5px] cursor-pointer hover:bg-bg-2 hover:border-line",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      {open ? (
        <Portal>
          <div
            ref={menuRef}
            id={id}
            role="menu"
            aria-label={ariaLabel}
            onKeyDown={onKey}
            className="min-w-[180px] bg-bg-1 border border-line rounded-[var(--r-md)] shadow-[var(--shadow-2)] p-1 z-[9999]"
            style={style}
          >
            {items.map((item, i) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                "flex items-center gap-[10px] h-[34px] px-[10px] rounded-[var(--r-sm)] text-[13px] text-txt-2 cursor-pointer border-none bg-transparent font-[inherit] text-left no-underline hover:bg-bg-3 w-full",
                item.destructive && "text-status-error",
                i === activeIndex && "bg-acc text-[var(--acc-ink)] shadow-[0_1px_0_rgba(0,0,0,0.06),0_2px_6px_rgba(233,84,32,0.30)]"
              )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Portal>
      ) : null}
    </div>
  );
}
