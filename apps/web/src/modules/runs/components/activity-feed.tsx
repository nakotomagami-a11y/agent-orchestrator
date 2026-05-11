"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { useRuns } from "../hooks/use-runs";
import { RunRow } from "./run-row";
import { dayLabel, groupRunsByDay } from "../utils/format-run-meta";

export type ActivityFeedProps = {
  agentId?: string;
};

export function ActivityFeed({ agentId }: ActivityFeedProps) {
  const t = useTranslations();
  const { data, isLoading } = useRuns({ agentId, limit: 200 });

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton width={160} height={20} />
        <div style={{ height: 12 }} />
        <Skeleton width="100%" height={48} />
        <div style={{ height: 6 }} />
        <Skeleton width="100%" height={48} />
        <div style={{ height: 6 }} />
        <Skeleton width="100%" height={48} />
      </div>
    );
  }

  const groups = groupRunsByDay(data ?? []);
  if (groups.length === 0) {
    return (
      <EmptyState
        icon="activity"
        title={t("runs.empty_title")}
        description={t("common.empty")}
      />
    );
  }

  return (
    <div className="tab-pane" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map((group) => (
        <Card key={group.day}>
          <CardHeader title={dayLabel(group.day)} sub={t("runs.runs_count_sub", { count: group.runs.length })} />
          <div>
            {group.runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
