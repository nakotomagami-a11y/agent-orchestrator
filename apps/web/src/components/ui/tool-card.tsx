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
  // If no children were provided but we have an arg, surface the full arg
  // text in the body so the disclosure actually reveals something.
  const body: ReactNode = children ?? (arg ? <pre className="tc-pre">{formatBody(arg)}</pre> : null);
  const hasBody = body !== null;
  const interactive = hasBody;
  return (
    <div className="tool-card" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="tc-h"
        aria-expanded={interactive ? open : undefined}
        aria-controls={hasBody ? bodyId : undefined}
        aria-disabled={interactive ? undefined : true}
        disabled={!interactive}
        onClick={() => interactive && setOpen((v) => !v)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          font: "inherit",
          color: "inherit",
          cursor: interactive ? "pointer" : "default",
          textAlign: "left",
        }}
      >
        <Icon name={open ? "chevron-down" : "chevron"} size={12} />
        <span className="tc-name">{name}</span>
        {arg ? <span className="tc-arg">{arg}</span> : null}
        {note ? <span className="tc-note">{note}</span> : null}
      </button>
      {open && hasBody ? (
        <div id={bodyId} className="tc-body">
          {body}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Pretty-print JSON-ish tool args for the expanded body. Non-JSON strings are
 * returned unchanged so plain-text args (file paths, prompts) stay readable.
 */
function formatBody(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return raw;
    }
  }
  return raw;
}
