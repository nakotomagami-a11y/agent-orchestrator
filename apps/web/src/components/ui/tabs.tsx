"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem<T extends string> = {
  value: T;
  label: ReactNode;
  count?: number | string;
};

export type TabsProps<T extends string> = {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
  className?: string;
};

export function Tabs<T extends string>({ items, value, onChange, ariaLabel, className }: TabsProps<T>) {
  const id = useId();
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("chat-tabs", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            id={`${id}-${item.value}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            type="button"
            className={cn("chat-tab", active && "on")}
            onClick={() => onChange(item.value)}
          >
            {item.label}
            {item.count !== undefined ? <span className="count">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
