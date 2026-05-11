"use client";

import { match } from "ts-pattern";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { Skeleton } from "@/components/ui/skeleton";
import { UnitSprite } from "@/components/ui/unit-sprite";
import { unitForAgent } from "@/components/ui/unit-sprite.utils";
import { StatusDot } from "@/components/ui/status-dot";
import { useRuns } from "@/modules/runs/hooks/use-runs";
import { useOfficeStore } from "@/modules/office/hooks/use-office-store";
import {
  formatCost,
  formatDuration,
  formatRelative,
} from "@/modules/runs/utils/format-run-meta";
import type { PersistedRun } from "@agent-office/shared/types";

export type ProjectActivityProps = {
  projectId: string;
};

/**
 * Read-only feed of runs scoped to a project. Audit surface, not a
 * coordination tool — clicking a row opens the agent's modal at the
 * History tab so you can see the full transcript in context.
 */
export function ProjectActivity({ projectId }: ProjectActivityProps) {
  const t = useTranslations();
  const select = useOfficeStore((s) => s.select);
  const { data, isLoading } = useRuns({ projectId, limit: 100 });

  const runs = data ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCost = runs
    .filter((r) => r.ts >= today.getTime())
    .reduce((sum, r) => sum + (r.cost || 0), 0);

  return (
    <Card>
      <CardHeader
        title={t("project_activity.card_title")}
        sub={
          isLoading
            ? t("project_activity.loading")
            : t("project_activity.sub_runs", { count: runs.length }) +
              (todayCost > 0 ? " " + t("project_activity.sub_today", { amount: formatCost(todayCost) }) : "")
        }
      />
      {isLoading ? (
        <div style={{ padding: 16 }}>
          <Skeleton width="100%" height={48} />
          <div style={{ height: 6 }} />
          <Skeleton width="100%" height={48} />
          <div style={{ height: 6 }} />
          <Skeleton width="100%" height={48} />
        </div>
      ) : runs.length === 0 ? (
        <div
          style={{
            padding: 20,
            fontSize: 13,
            color: "var(--txt-3)",
            textAlign: "center",
          }}
        >
          {t("project_activity.empty")}
        </div>
      ) : (
        <div>
          {runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              onOpen={() => select(run.agentId, { tab: "history" })}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function RunRow({ run, onOpen }: { run: PersistedRun; onOpen: () => void }) {
  const status = match(run.status)
    .with("running", () => "working" as const)
    .with("done", () => "done" as const)
    .with("error", () => "error" as const)
    .exhaustive();
  // Project activity rows don't have the full ApiAgent — fall back to the
  // hash-derived unit. Once we plumb the per-agent unit through the run
  // record we can honour overrides here too.
  const unit = unitForAgent(run.agentId);
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        width: "100%",
        background: "transparent",
        border: "none",
        textAlign: "left",
        cursor: "pointer",
        font: "inherit",
        color: "inherit",
        padding: 0,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32px 1fr auto auto",
          gap: 12,
          alignItems: "center",
          padding: "10px 14px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ width: 32, height: 32 }} aria-hidden>
          <UnitSprite unit={unit} size={32} animate />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {run.agentName}
            <StatusDot status={status} hideLabel />
          </div>
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
            minWidth: 60,
            textAlign: "right",
          }}
        >
          {formatRelative(run.ts)}
        </span>
      </div>
    </button>
  );
}
