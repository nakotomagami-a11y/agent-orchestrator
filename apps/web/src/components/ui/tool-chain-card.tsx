"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "./icon";
import { ToolCard } from "./tool-card";

export type ToolChainItem = { id: string; name: string; arg?: string };

export type ToolChainCardProps = {
  /** Calls in the chain, in invocation order. */
  items: ToolChainItem[];
  /**
   * True when this chain is the tail of an in-flight run — header surfaces the
   * latest call as "what I'm doing now" with a pulsing dot.
   */
  live?: boolean;
  /** Open the disclosure on first render. Defaults to false (collapsed). */
  defaultOpen?: boolean;
};

/**
 * One collapsed row instead of N. Compacts a run of consecutive tool calls
 * (Read, Bash, Read, Read…) into a single disclosure so the thread reads as
 * "what the agent did" rather than a wall of identical headers.
 *
 * Header content, in order:
 *   chevron · [pulse dot if live] · count · per-tool tally · latest call
 *
 * The expanded body re-uses the existing ToolCard so per-call arg drill-in
 * still works exactly as before.
 */
export function ToolChainCard({ items, live = false, defaultOpen = false }: ToolChainCardProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  const tally = useMemo(() => buildTally(items), [items]);
  const latest = items[items.length - 1];

  return (
    <div
      className="tool-chain-card"
      data-open={open ? "true" : "false"}
      data-live={live ? "true" : "false"}
    >
      <button
        type="button"
        className="tcc-h"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? "chevron-down" : "chevron"} size={12} />
        {live ? <span className="tcc-dot" aria-hidden /> : null}
        <span className="tcc-count">
          {t("tool_chain.actions", { count: items.length })}
        </span>
        {tally ? (
          <>
            <span className="tcc-sep" aria-hidden>·</span>
            <span className="tcc-tally">{tally}</span>
          </>
        ) : null}
        {latest ? (
          <span className="tcc-latest">
            <span className="tcc-latest-lbl">
              {live ? t("tool_chain.label_now") : t("tool_chain.label_last")}
            </span>
            <span className="tcc-latest-name">{latest.name}</span>
            {latest.arg ? (
              <span className="tcc-latest-arg">{summarizeArg(latest.arg)}</span>
            ) : null}
          </span>
        ) : null}
      </button>
      {open ? (
        <div id={bodyId} className="tcc-body">
          {items.map((item) => (
            <ToolCard key={item.id} name={item.name} arg={item.arg} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** "Read ×4 · Bash ×2" — short and stable so the header doesn't wrap. */
function buildTally(items: ToolChainItem[]): string {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.name, (counts.get(i.name) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
    .join(" · ");
}

/**
 * The inline "latest" preview wants the most informative single value from a
 * tool's args, not the entire JSON blob. Falls back to the raw string when
 * the arg isn't a recognisable object.
 */
function summarizeArg(arg: string): string {
  const trimmed = arg.trim();
  const looksLikeJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));
  if (!looksLikeJson) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      // Prefer common "what's being acted on" keys before falling back to the
      // first non-empty string value.
      const preferred = ["file_path", "path", "command", "pattern", "query", "url", "description"];
      for (const k of preferred) {
        const v = obj[k];
        if (typeof v === "string" && v.length > 0) return v;
      }
      for (const v of Object.values(obj)) {
        if (typeof v === "string" && v.length > 0) return v;
      }
    }
  } catch {
    /* fall through to raw */
  }
  return trimmed;
}
