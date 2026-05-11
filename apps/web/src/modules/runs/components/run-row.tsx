"use client";

import Link from "next/link";
import { match } from "ts-pattern";
import { StatusDot } from "@/components/ui/status-dot";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import type { PersistedRun } from "@agent-office/shared/types";
import { formatCost, formatDuration, formatRelative } from "../utils/format-run-meta";

export type RunRowProps = {
  run: PersistedRun;
};

export function RunRow({ run }: RunRowProps) {
  const status = match(run.status)
    .with("running", () => "working" as const)
    .with("done", () => "done" as const)
    .with("error", () => "error" as const)
    .exhaustive();

  return (
    <Link
      href={PAGE_ROUTES.run(run.id)}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        gap: 12,
        alignItems: "center",
        padding: "10px 14px",
        borderBottom: "1px solid var(--line)",
        textDecoration: "none",
        color: "var(--txt)",
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
  );
}
