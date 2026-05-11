"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ModalShell } from "@/components/ui/modal-shell";
import { TextInput } from "@/components/ui/text-input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import {
  useClaudeLimitsHydration,
  useClaudeLimitsStore,
  planLabel,
  periodStart,
  periodEnd,
  type ClaudePlan,
  type LimitsPeriod,
} from "@/lib/claude-limits-store";
import { useRuns } from "@/modules/runs/hooks/use-runs";

const PLAN_OPTIONS: ClaudePlan[] = ["pro", "max-5x", "max-20x", "api", "custom"];

/**
 * Manually-configured Claude plan + locally-measured usage. The numbers come
 * from `runs.log` (everything summoned from this app), so they undercount
 * anything the user runs through plain `claude` outside the dashboard — that
 * caveat is shown explicitly.
 */
export function ClaudeLimitsModal() {
  const t = useTranslations();
  useClaudeLimitsHydration();
  const open = useClaudeLimitsStore((s) => s.open);
  const setOpen = useClaudeLimitsStore((s) => s.setOpen);
  const plan = useClaudeLimitsStore((s) => s.plan);
  const quotaUsd = useClaudeLimitsStore((s) => s.quotaUsd);
  const period = useClaudeLimitsStore((s) => s.period);
  const update = useClaudeLimitsStore((s) => s.update);

  const runsQ = useRuns({ limit: 500 });
  const runs = runsQ.data ?? [];

  const start = periodStart(period);
  const end = periodEnd(period);
  const inPeriod = useMemo(
    () => runs.filter((r) => r.ts >= start && r.ts < end),
    [runs, start, end],
  );

  const usedPeriod = inPeriod.reduce((s, r) => s + (r.cost || 0), 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const usedToday = runs
    .filter((r) => r.ts >= today.getTime())
    .reduce((s, r) => s + (r.cost || 0), 0);

  const byModel: Record<string, { runs: number; cost: number; tokensIn: number; tokensOut: number }> = {};
  for (const r of inPeriod) {
    const k = r.model || "unknown";
    const bucket = byModel[k] ?? { runs: 0, cost: 0, tokensIn: 0, tokensOut: 0 };
    bucket.runs += 1;
    bucket.cost += r.cost || 0;
    bucket.tokensIn += r.tokensIn || 0;
    bucket.tokensOut += r.tokensOut || 0;
    byModel[k] = bucket;
  }
  const modelRows = Object.entries(byModel).sort((a, b) => b[1].cost - a[1].cost);

  const resetIn = formatResetCountdown(end);
  const usedPct = quotaUsd > 0 ? Math.min(100, (usedPeriod / quotaUsd) * 100) : null;

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title={t("limits.title")}
      size="md"
      footer={
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          {t("limits.done_button")}
        </button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Section title={t("limits.section_plan")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={t("limits.label_plan")}>
              <Select
                value={plan}
                onChange={(e) => update({ plan: e.target.value as ClaudePlan })}
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>{planLabel(p)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("limits.label_period")}>
              <Select
                value={period}
                onChange={(e) => update({ period: e.target.value as LimitsPeriod })}
              >
                <option value="week">{t("limits.period_week")}</option>
                <option value="month">{t("limits.period_month")}</option>
              </Select>
            </Field>
            <Field
              label={t("limits.label_quota_cap")}
              span={2}
              hint={t("limits.quota_hint")}
            >
              <TextInput
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={String(quotaUsd)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  update({ quotaUsd: Number.isFinite(v) && v >= 0 ? v : 0 });
                }}
                placeholder={t("limits.quota_placeholder")}
              />
            </Field>
          </div>
        </Section>

        <Section title={t("limits.section_usage")}>
          {runsQ.isLoading ? (
            <Skeleton width="100%" height={70} />
          ) : (
            <>
              <UsageBar
                used={usedPeriod}
                quota={quotaUsd}
                pct={usedPct}
                resetIn={resetIn}
                period={period}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                  marginTop: 12,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                <Metric label={t("limits.metric_today")} value={`$${usedToday.toFixed(2)}`} />
                <Metric
                  label={period === "week" ? t("limits.metric_this_week") : t("limits.metric_this_month")}
                  value={`$${usedPeriod.toFixed(2)}`}
                />
                <Metric
                  label={t("limits.metric_runs_in_period")}
                  value={inPeriod.length.toLocaleString()}
                />
              </div>
            </>
          )}
        </Section>

        {modelRows.length > 0 ? (
          <Section title={t("limits.section_by_model")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {modelRows.map(([m, b]) => (
                <ModelRow
                  key={m}
                  model={m}
                  runs={b.runs}
                  cost={b.cost}
                  tokens={b.tokensIn + b.tokensOut}
                  totalCost={usedPeriod}
                />
              ))}
            </div>
          </Section>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            fontSize: 11.5,
            color: "var(--txt-3)",
            lineHeight: 1.5,
          }}
        >
          <Icon name="memory" size={13} />
          <span>
            Counts only what Agent Office summoned (saved in
            <code style={{ marginLeft: 4 }}>~/.claude/agent-office/runs.log</code>). Anything you
            ran through plain <code>claude</code> outside the dashboard isn&apos;t included.
          </span>
        </div>
      </div>
    </ModalShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: "var(--txt-3)",
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  span = 1,
  children,
}: {
  label: string;
  hint?: string;
  span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: `span ${span}` }}>
      <span
        style={{
          fontSize: 11,
          color: "var(--txt-3)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {label}
      </span>
      {children}
      {hint ? (
        <span style={{ fontSize: 11, color: "var(--txt-4)" }}>{hint}</span>
      ) : null}
    </label>
  );
}

function UsageBar({
  used,
  quota,
  pct,
  resetIn,
  period,
}: {
  used: number;
  quota: number;
  pct: number | null;
  resetIn: string;
  period: LimitsPeriod;
}) {
  const colour = pct === null ? "var(--acc)" : pct >= 90 ? "var(--error)" : pct >= 70 ? "var(--queued)" : "var(--acc)";
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 13 }}>
          {quota > 0 ? (
            <>
              <b style={{ fontFamily: "var(--font-mono)" }}>${used.toFixed(2)}</b> of{" "}
              <b style={{ fontFamily: "var(--font-mono)" }}>${quota.toFixed(2)}</b> used
            </>
          ) : (
            <>
              <b style={{ fontFamily: "var(--font-mono)" }}>${used.toFixed(2)}</b> used this{" "}
              {period}
            </>
          )}
        </span>
        <span style={{ fontSize: 11, color: "var(--txt-3)", fontFamily: "var(--font-mono)" }}>
          resets in {resetIn}
        </span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: "var(--bg-2)",
          overflow: "hidden",
          border: "1px solid var(--line)",
        }}
        aria-label={pct === null ? "No quota set" : `${pct.toFixed(0)}% used`}
      >
        {pct !== null ? (
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: colour,
              transition: "width 200ms ease",
            }}
          />
        ) : null}
      </div>
      {pct !== null ? (
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: "var(--txt-3)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {pct.toFixed(1)}% of cap
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-md)",
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: 10.5, color: "var(--txt-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function ModelRow({
  model,
  runs,
  cost,
  tokens,
  totalCost,
}: {
  model: string;
  runs: number;
  cost: number;
  tokens: number;
  totalCost: number;
}) {
  const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr auto",
        gap: 10,
        alignItems: "center",
        fontSize: 12.5,
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{model}</span>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: "var(--bg-2)",
          overflow: "hidden",
          border: "1px solid var(--line)",
        }}
        aria-label={`${pct.toFixed(0)}% of period cost`}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--acc)" }} />
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          color: "var(--txt-3)",
          textAlign: "right",
          minWidth: 140,
        }}
      >
        {runs} run{runs === 1 ? "" : "s"} · {tokens.toLocaleString()} tok · ${cost.toFixed(2)}
      </span>
    </div>
  );
}

function formatResetCountdown(endTs: number): string {
  const ms = Math.max(0, endTs - Date.now());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 1) return `${days}d ${hours}h`;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}
