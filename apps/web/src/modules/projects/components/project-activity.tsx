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
        <div className="p-4">
          <Skeleton width="100%" height={48} />
          <div className="h-1.5" />
          <Skeleton width="100%" height={48} />
          <div className="h-1.5" />
          <Skeleton width="100%" height={48} />
        </div>
      ) : runs.length === 0 ? (
        <div className="p-5 text-[13px] text-txt-3 text-center">
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
      className="w-full bg-transparent border-none text-left cursor-pointer font-[inherit] text-[inherit] p-0"
    >
      <div
        className="grid gap-3 items-center px-3.5 py-2.5 border-b border-line"
        style={{ gridTemplateColumns: "32px 1fr auto auto" }}
      >
        <div className="w-8 h-8" aria-hidden>
          <UnitSprite unit={unit} size={32} animate />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold flex items-center gap-1.5">
            {run.agentName}
            <StatusDot status={status} hideLabel />
          </div>
          <div
            className="text-[11.5px] text-txt-3 font-mono overflow-hidden text-ellipsis whitespace-nowrap"
            title={run.prompt}
          >
            {run.prompt}
          </div>
        </div>
        <span className="font-mono text-[11px] text-txt-3">
          {formatDuration(run.durMs)} · {formatCost(run.cost)}
        </span>
        <span className="font-mono text-[11px] text-txt-3 min-w-[60px] text-right">
          {formatRelative(run.ts)}
        </span>
      </div>
    </button>
  );
}
