"use client";

import Link from "next/link";
import { match } from "ts-pattern";
import { StatusDot } from "@/components/ui/status-dot";
import { Icon } from "@/components/ui/icon";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import { useCompareStore } from "@/lib/compare-store";
import type { PersistedRun } from "@agent-office/shared/types";
import { formatCost, formatDuration, formatRelative } from "../utils/format-run-meta";

export type RunRowProps = {
  run: PersistedRun;
};

export function RunRow({ run }: RunRowProps) {
  const openCompare = useCompareStore((s) => s.openWith);

  const status = match(run.status)
    .with("running", () => "working" as const)
    .with("done", () => "done" as const)
    .with("error", () => "error" as const)
    .exhaustive();

  return (
    <div
      className="run-row"
      style={{
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {/* The link carries the primary run content */}
      <Link
        href={PAGE_ROUTES.run(run.id)}
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "auto 1fr auto auto",
          gap: 12,
          padding: "10px 14px",
          textDecoration: "none",
          color: "var(--txt)",
          alignItems: "center",
          minWidth: 0,
        }}
      >
        <StatusDot status={status} hideLabel />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{run.agentName}</div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--txt-3)",
              fontFamily: "var(--font-mono)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={run.prompt}
          >
            {run.prompt}
          </div>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--txt-3)",
          }}
        >
          {formatDuration(run.durMs)} · {formatCost(run.cost)}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--txt-3)",
            minWidth: 56,
            textAlign: "right",
          }}
        >
          {formatRelative(run.ts)}
        </span>
      </Link>

      {/* Fork button — outside the link so click doesn't navigate */}
      <div style={{ padding: "0 12px 0 0", flexShrink: 0 }}>
        <button
          type="button"
          className="btn sm ghost run-row-fork"
          title="Fork run"
          aria-label={`Fork run ${run.id}`}
          onClick={() => openCompare(run.id)}
          style={{ opacity: 0, transition: "opacity 120ms" }}
        >
          <Icon name="branch" />
        </button>
      </div>
    </div>
  );
}
