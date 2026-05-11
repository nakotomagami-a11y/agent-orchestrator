"use client";

import { useId, useState, type ReactNode } from "react";
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
  const bodyId = useId();
  return (
    <div className="tool-card">
      <button
        type="button"
        className="tc-h"
        aria-expanded={open}
        aria-controls={children ? bodyId : undefined}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          font: "inherit",
          color: "inherit",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Icon name={open ? "chevron-down" : "chevron"} size={12} />
        <span className="tc-name">{name}</span>
        {arg ? <span className="tc-arg">{arg}</span> : null}
        {note ? <span className="tc-note">{note}</span> : null}
      </button>
      {open && children ? (
        <div id={bodyId} className="tc-body">
          {children}
        </div>
      ) : null}
    </div>
  );
}
