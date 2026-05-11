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
        <div style={{ height: 16 }} />
        <Skeleton width="100%" height={300} />
      </div>
    );
  }
  if (!run) {
    return (
      <div className="tab-pane">
        <p style={{ color: "var(--txt-3)" }}>{t("errors.not_found")}</p>
      </div>
    );
  }

  const status = match(run.status)
    .with("running", () => "working" as const)
    .with("done", () => "done" as const)
    .with("error", () => "error" as const)
    .exhaustive();

  return (
    <div className="tab-pane" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <CardHeader
          title={run.agentName}
          sub={`${formatRelative(run.ts)} · ${formatDuration(run.durMs)} · ${formatCost(run.cost)}`}
          right={<StatusDot status={status} />}
        />
        <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 8, columnGap: 12, fontSize: 12 }}>
          <span style={{ color: "var(--txt-3)", fontFamily: "var(--font-mono)" }}>model</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{run.model} · {run.effort}</span>
          <span style={{ color: "var(--txt-3)", fontFamily: "var(--font-mono)" }}>tokens</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{run.tokensIn}↓ / {run.tokensOut}↑</span>
          {run.cwd ? (
            <>
              <span style={{ color: "var(--txt-3)", fontFamily: "var(--font-mono)" }}>cwd</span>
              <span style={{ fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis" }}>{run.cwd}</span>
            </>
          ) : null}
          {run.projectId ? (
            <>
              <span style={{ color: "var(--txt-3)", fontFamily: "var(--font-mono)" }}>project</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{run.projectId} · {run.instanceLabel ?? run.instanceId}</span>
            </>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Prompt" />
        <div style={{ padding: 16 }}>
          <CodeBlock body={run.prompt} lang="prompt" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Output" />
        <div style={{ padding: 16 }}>
          {run.output ? (
            <CodeBlock body={run.output} lang={run.status === "error" ? "error" : "stdout"} />
          ) : (
            <p style={{ color: "var(--txt-3)", fontSize: 13 }}>(no output)</p>
          )}
        </div>
      </Card>
    </div>
  );
}
