"use client";

import { match } from "ts-pattern";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { StatusDot } from "@/components/ui/status-dot";
import { CodeBlock } from "@/components/ui/code-block";
import { useRun } from "../hooks/use-runs";
import { formatCost, formatDuration, formatRelative } from "../utils/format-run-meta";

export type RunDetailProps = { runId: string };

export function RunDetail({ runId }: RunDetailProps) {
  const t = useTranslations();
  const { data: run, isLoading } = useRun(runId);

  if (isLoading) {
    return (
      <div className="tab-pane">
        <Skeleton width={220} height={20} />
        <div className="h-4" />
        <Skeleton width="100%" height={300} />
      </div>
    );
  }
  if (!run) {
    return (
      <div className="tab-pane">
        <p className="text-txt-3">{t("errors.not_found")}</p>
      </div>
    );
  }

  const status = match(run.status)
    .with("running", () => "working" as const)
    .with("done", () => "done" as const)
    .with("error", () => "error" as const)
    .exhaustive();

  return (
    <div className="tab-pane flex flex-col gap-[14px]">
      <Card>
        <CardHeader
          title={run.agentName}
          sub={`${formatRelative(run.ts)} · ${formatDuration(run.durMs)} · ${formatCost(run.cost)}`}
          right={<StatusDot status={status} />}
        />
        <div className="px-4 py-3 grid text-xs gap-y-2 gap-x-3" style={{ gridTemplateColumns: "120px 1fr" }}>
          <span className="text-txt-3 font-mono">{t("run_detail.field_model")}</span>
          <span className="font-mono">{run.model} · {run.effort}</span>
          <span className="text-txt-3 font-mono">{t("run_detail.field_tokens")}</span>
          <span className="font-mono">{run.tokensIn}↓ / {run.tokensOut}↑</span>
          {run.cwd ? (
            <>
              <span className="text-txt-3 font-mono">{t("run_detail.field_cwd")}</span>
              <span className="font-mono overflow-hidden text-ellipsis">{run.cwd}</span>
            </>
          ) : null}
          {run.projectId ? (
            <>
              <span className="text-txt-3 font-mono">{t("run_detail.field_project")}</span>
              <span className="font-mono">{run.projectId} · {run.instanceLabel ?? run.instanceId}</span>
            </>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title={t("run_detail.prompt_card_title")} />
        <div className="p-4">
          <CodeBlock body={run.prompt} lang="prompt" />
        </div>
      </Card>

      <Card>
        <CardHeader title={t("run_detail.output_card_title")} />
        <div className="p-4">
          {run.output ? (
            <CodeBlock body={run.output} lang={run.status === "error" ? "error" : "stdout"} />
          ) : (
            <p className="text-txt-3 text-[13px]">{t("run_detail.output_empty")}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
