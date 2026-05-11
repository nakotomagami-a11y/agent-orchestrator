"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ModalShell } from "@/components/ui/modal-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useRun, useRuns } from "@/modules/runs/hooks/use-runs";
import { useCompareStore } from "@/lib/compare-store";
import { formatCost, formatRelative } from "@/modules/runs/utils/format-run-meta";
import type { PersistedRun } from "@agent-office/shared/types";

export function CompareModal() {
  const t = useTranslations("compare");
  const open = useCompareStore((s) => s.open);
  const baseRunId = useCompareStore((s) => s.baseRunId);
  const close = useCompareStore((s) => s.close);

  const baseQ = useRun(baseRunId);
  const baseRun = baseQ.data ?? null;

  // Load runs for the same agent so the right-pane select has options
  const agentRunsQ = useRuns({
    agentId: baseRun?.agentId,
    limit: 100,
  });
  const candidateRuns = (agentRunsQ.data ?? []).filter((r) => r.id !== baseRunId);

  const [compareId, setCompareId] = useState<string | null>(null);
  const compareQ = useRun(compareId);
  const compareRun = compareQ.data ?? null;

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t("title")}
      size="lg"
      footer={
        <button type="button" className="btn" onClick={close}>
          {t("close")}
        </button>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          minHeight: 200,
        }}
      >
        {/* Left pane — base run */}
        <div>
          <PaneLabel>{t("base_run")}</PaneLabel>
          {baseQ.isLoading ? (
            <Skeleton width="100%" height={160} />
          ) : baseRun ? (
            <RunPane run={baseRun} />
          ) : (
            <Empty />
          )}
        </div>

        {/* Right pane — comparison run */}
        <div>
          <PaneLabel>{t("compare_with")}</PaneLabel>
          <select
            value={compareId ?? ""}
            onChange={(e) => setCompareId(e.target.value || null)}
            aria-label={t("compare_with")}
            style={{
              width: "100%",
              height: 32,
              padding: "0 8px",
              marginBottom: 12,
              border: "1px solid var(--line-2)",
              borderRadius: "var(--r-md)",
              background: "var(--bg-1)",
              color: "var(--txt)",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
            }}
          >
            <option value="">{t("pick_run")}</option>
            {candidateRuns.map((r) => (
              <option key={r.id} value={r.id}>
                {formatRelative(r.ts)} · {r.prompt.slice(0, 50)}
              </option>
            ))}
          </select>
          {compareQ.isLoading ? (
            <Skeleton width="100%" height={160} />
          ) : compareRun ? (
            <RunPane run={compareRun} />
          ) : (
            <Empty message={t("pick_run")} />
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function PaneLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        color: "var(--txt-3)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 600,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function RunPane({ run }: { run: PersistedRun }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-md)",
        padding: 12,
      }}
    >
      {/* Prompt */}
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontStyle: "italic",
          color: "var(--txt-2)",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {run.prompt}
      </p>

      {/* Model + cost badge */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Badge>{run.model ?? "default"}</Badge>
        <Badge>{formatCost(run.cost)}</Badge>
        <Badge>{(run.tokensIn + run.tokensOut).toLocaleString()} tok</Badge>
      </div>

      {/* Output */}
      <pre
        style={{
          margin: 0,
          overflow: "auto" as const,
          maxHeight: 300,
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "var(--txt)",
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          padding: "8px 10px",
        }}
      >
        {run.output || "(no output)"}
      </pre>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        color: "var(--txt-2)",
      }}
    >
      {children}
    </span>
  );
}

function Empty({ message }: { message?: string }) {
  return (
    <div
      style={{
        padding: "32px 0",
        textAlign: "center",
        fontSize: 13,
        color: "var(--txt-3)",
      }}
    >
      {message ?? "—"}
    </div>
  );
}
