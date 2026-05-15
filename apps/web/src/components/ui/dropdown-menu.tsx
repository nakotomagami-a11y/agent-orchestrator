"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
};

export function DropdownMenu({ trigger, items, ariaLabel, align = "end" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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
        className="tb-btn"
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={onKey}
          className="absolute top-[calc(100%+4px)] min-w-[180px] bg-bg-1 border border-line rounded-[var(--r-md)] shadow-[var(--shadow-2)] p-1 z-50"
          style={{ [align === "end" ? "right" : "left"]: 0 }}
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
              className={cn("nav-item w-full", i === activeIndex && "on")}
              style={{ color: item.destructive ? "var(--error)" : undefined }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
