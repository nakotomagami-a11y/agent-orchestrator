"use client";

import { useState } from "react";
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
  projectId?: string;
};

export function ActivityFeed({ agentId, projectId }: ActivityFeedProps) {
  const t = useTranslations();
  const { data, isLoading } = useRuns({ agentId, projectId, limit: 200 });

  const [statusFilter, setStatusFilter] = useState<"all" | "done" | "error">("all");
  const [search, setSearch] = useState("");

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

  const filtered = (data ?? []).filter(
    (run) =>
      (statusFilter === "all" || run.status === statusFilter) &&
      (search === "" || run.prompt.toLowerCase().includes(search.toLowerCase())),
  );

  const groups = groupRunsByDay(filtered);

  return (
    <div className="tab-pane" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          placeholder={t("activity_feed.search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            padding: "5px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--txt)",
            outline: "none",
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            padding: "5px 8px",
            fontSize: 12,
            color: "var(--txt)",
            outline: "none",
          }}
        >
          <option value="all">{t("activity_feed.filter_all")}</option>
          <option value="done">{t("activity_feed.filter_done")}</option>
          <option value="error">{t("activity_feed.filter_error")}</option>
        </select>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon="activity"
          title={t("runs.empty_title")}
          description={t("common.empty")}
        />
      ) : (
        groups.map((group) => (
          <Card key={group.day}>
            <CardHeader title={dayLabel(group.day)} sub={t("runs.runs_count_sub", { count: group.runs.length })} />
            <div>
              {group.runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
