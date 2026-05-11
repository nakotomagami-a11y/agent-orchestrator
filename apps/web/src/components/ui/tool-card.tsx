"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "./icon";

export type ToolCardProps = {
  name: string;
  arg?: string;
  note?: string;
  children?: ReactNode;
  defaultOpen?: boolean;
};

export function ToolCard({ name, arg, note, children, defaultOpen = false }: ToolCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="tool-card">
      <div
        className="tc-h"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <Icon name={open ? "chevron-down" : "chevron"} size={12} />
        <span className="tc-name">{name}</span>
        {arg ? <span className="tc-arg">{arg}</span> : null}
        {note ? <span className="tc-note">{note}</span> : null}
      </div>
      {open && children ? <div className="tc-body">{children}</div> : null}
    </div>
  );
}
