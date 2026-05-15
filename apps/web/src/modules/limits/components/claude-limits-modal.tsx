"use client";

import { useState, useEffect, useMemo } from "react";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  useClaudeLimitsHydration,
  useClaudeLimitsStore,
  periodStart,
  periodEnd,
  type ClaudePlan,
  type LimitsPeriod,
} from "@/lib/claude-limits-store";
import { useRuns } from "@/modules/runs/hooks/use-runs";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const fmtUSD = (n: number, dec = 2): string => `$${n.toFixed(dec)}`;
const fmtTok = (n: number): string => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

function formatResetCountdown(endTs: number): string {
  const ms = Math.max(0, endTs - Date.now());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 1) return `${days}d ${hours}h`;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

/* ------------------------------------------------------------------ */
/* Plan config                                                          */
/* ------------------------------------------------------------------ */

const PLAN_DEFS: { id: ClaudePlan; name: string; price: string; feat: string; icon: string }[] = [
  { id: "free",  name: "Free",  price: "$0/mo",    feat: "standard usage · web + mobile · all integrations",      icon: "F" },
  { id: "pro",   name: "Pro",   price: "$20/mo",   feat: "more usage than free · all models · Claude Code",       icon: "P" },
  { id: "max",   name: "Max",   price: "$100/mo+", feat: "5× or 20× Pro usage · priority access · early features", icon: "M" },
];

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function SectionHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="lim-section-head">
      <span className="marker" />
      <h3>{title}</h3>
      {sub && <span className="sub">{sub}</span>}
      {right && <span className="right">{right}</span>}
    </div>
  );
}

function LimHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="limits-head">
      <div className="icon" aria-hidden="true">⚡</div>
      <div className="titles">
        <div className="title">Usage &amp; limits</div>
        <div className="sub">spend caps, plan, and per-model breakdown · workspace local</div>
      </div>
      <button className="close" aria-label="Close" onClick={onClose}>×</button>
    </div>
  );
}

function Gauge({ pct, status }: { pct: number; status: "ok" | "warn" | "bad" }) {
  const r = 56;
  const circumference = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct)) * circumference;
  const color =
    status === "bad"  ? "var(--ao-bad)"  :
    status === "warn" ? "var(--ao-warn)" :
    "var(--ao-accent)";
  const glowColor =
    status === "bad"  ? "var(--ao-bad)"  :
    status === "warn" ? "var(--ao-warn)" :
    "var(--ao-accent-soft)";
  return (
    <div className="gauge">
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle cx={70} cy={70} r={r} fill="none" stroke="var(--ao-bg-3)" strokeWidth={10} />
        <circle
          cx={70} cy={70} r={r} fill="none"
          stroke={color} strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="origin-[70px_70px] -rotate-90"
          style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }}
        />
      </svg>
      <div className="label">
        <div className="pct">{Math.round(pct * 100)}%</div>
        <div className="lbl">used</div>
      </div>
    </div>
  );
}

function BudgetHero({
  spentPeriod,
  spentToday,
  quotaUsd,
  period,
  forecast,
  resetIn,
}: {
  spentPeriod: number;
  spentToday: number;
  quotaUsd: number;
  period: LimitsPeriod;
  forecast: number;
  resetIn: string;
}) {
  const tracked = quotaUsd > 0;
  const pct = tracked ? spentPeriod / quotaUsd : 0;
  const status: "ok" | "warn" | "bad" = pct >= 1 ? "bad" : pct >= 0.8 ? "warn" : "ok";
  const forecastPct = tracked ? forecast / quotaUsd : 0;

  const periodLabel =
    period === "daily" ? "Today" :
    period === "month" ? "This month" :
    "This week";

  // Burn rate: today's spend as a daily rate
  const burnRate = spentToday;

  const forecastDelta = tracked ? forecast - quotaUsd : 0;

  return (
    <div className="budget-hero">
      <div className="left">
        <div className="kicker">
          <span className="pulse" aria-hidden="true" />
          {periodLabel}
          <span className="text-[var(--ao-fg-3)] ml-1">· resets in {resetIn}</span>
        </div>

        <div className="big">
          {fmtUSD(spentPeriod)}
          {tracked ? (
            <span className="cap">/ {fmtUSD(quotaUsd, 0)} cap</span>
          ) : (
            <span className="untracked">no cap · track-only</span>
          )}
        </div>

        {tracked && (
          <div className="progress" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`fill${status === "ok" ? "" : ` ${status}`}`}
              style={{ width: `${Math.min(100, pct * 100)}%` }}
            />
            {forecastPct > 0 && forecastPct < 1.02 && forecastPct > pct && (
              <div
                className="marker"
                title="Forecast"
                style={{ left: `${Math.min(98, forecastPct * 100)}%` }}
              />
            )}
          </div>
        )}

        <div className="stats-row">
          <div className="item">
            <span className="l">Today</span>
            <span className="v">{fmtUSD(spentToday)}</span>
          </div>
          <div className="item">
            <span className="l">Burn rate</span>
            <span className="v">
              {fmtUSD(burnRate)}
              <span className="muted text-[10px] ml-1">/day</span>
            </span>
          </div>
          <div className="item">
            <span className="l">Forecast end</span>
            <span className="v">
              {fmtUSD(forecast)}
              {tracked && (
                <span className={`delta${forecastDelta > 0 ? " bad" : ""}`}>
                  {forecastDelta > 0 ? "↑" : "↓"} {fmtUSD(Math.abs(forecastDelta))}
                </span>
              )}
            </span>
          </div>
          <div className="item">
            <span className="l">Status</span>
            <span className="v">
              {!tracked ? (
                <span className="badge neutral">tracking</span>
              ) : status === "ok" ? (
                <span className="badge ok">on track</span>
              ) : status === "warn" ? (
                <span className="badge warn">approaching</span>
              ) : (
                <span className="badge bad">over cap</span>
              )}
            </span>
          </div>
        </div>
      </div>

      <Gauge pct={tracked ? pct || 0.001 : 0.001} status={status} />
    </div>
  );
}

function PlanGrid({ value }: { value: ClaudePlan }) {
  return (
    <div className="plan-grid">
      {PLAN_DEFS.map((p) => (
        <div
          key={p.id}
          className={`plan-tile cursor-default pointer-events-none${value === p.id ? " active" : ""}`}
        >
          <div className="n">
            <span
              className="w-[22px] h-[22px] bg-[var(--ao-bg-3)] border border-[var(--ao-line-1)] rounded-[6px] inline-grid place-items-center text-[11px] font-[var(--ao-font-mono)] shrink-0"
            >
              {p.icon}
            </span>
            {p.name}
            {value === p.id && <span className="pick" aria-hidden="true">✓</span>}
          </div>
          <div className="price">{p.price}</div>
          <div className="feat">{p.feat}</div>
        </div>
      ))}
    </div>
  );
}

function PeriodSeg({
  value,
  onChange,
}: {
  value: LimitsPeriod;
  onChange: (p: LimitsPeriod) => void;
}) {
  const opts: { id: LimitsPeriod; label: string }[] = [
    { id: "daily",  label: "Daily"   },
    { id: "week",   label: "Weekly"  },
    { id: "month",  label: "Monthly" },
  ];
  return (
    <div className="period-seg" role="group" aria-label="Reset period">
      {opts.map((o) => (
        <button
          key={o.id}
          className={value === o.id ? "active" : ""}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const CAP_PRESETS = [0, 20, 50, 100, 250];

function QuotaCap({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const isPreset = CAP_PRESETS.includes(value);
  return (
    <div className="cap-row">
      {CAP_PRESETS.map((p) => (
        <button
          key={p}
          className={`cap-chip${value === p ? " active" : ""}`}
          onClick={() => onChange(p)}
          aria-pressed={value === p}
        >
          {p === 0 ? (
            <>Off <span className="lbl">· track only</span></>
          ) : (
            <><span className="lbl">$</span>{p}</>
          )}
        </button>
      ))}
      <span className="cap-custom">
        <span className="pfx" aria-hidden="true">$</span>
        <input
          type="number"
          placeholder="custom"
          aria-label="Custom cap amount in USD"
          value={isPreset ? "" : value || ""}
          min="0"
          step="1"
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(Number.isFinite(v) && v >= 0 ? v : 0);
          }}
        />
      </span>
    </div>
  );
}

function BehaviorButtons({
  value,
  onChange,
}: {
  value: "off" | "warn" | "block";
  onChange: (v: "off" | "warn" | "block") => void;
}) {
  const opts: { id: "off" | "warn" | "block"; icon: string; title: string; desc: string }[] = [
    { id: "off",   icon: "👁",  title: "Track only",  desc: "Record usage, never block. Good for visibility." },
    { id: "warn",  icon: "⚠",  title: "Warn at cap",  desc: "Notify when usage crosses 80% and 100%." },
    { id: "block", icon: "🔒", title: "Hard block",   desc: "Refuse new runs after the cap is hit." },
  ];
  return (
    <div className="behavior" role="group" aria-label="Behavior on cap">
      {opts.map((o) => (
        <button
          key={o.id}
          className={value === o.id ? "active" : ""}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
        >
          <div className="t"><span aria-hidden="true">{o.icon}</span> {o.title}</div>
          <div className="d">{o.desc}</div>
        </button>
      ))}
    </div>
  );
}

function DailyBars({ last14 }: { last14: { label: string; spend: number }[] }) {
  const max = Math.max(...last14.map((d) => d.spend), 0.01);
  return (
    <div className="daily-bars">
      <div className="row" role="img" aria-label="Last 14 days of spend">
        {last14.map((d, i) => {
          const isToday = i === last14.length - 1;
          const hPct = Math.max(3, (d.spend / max) * 100);
          return (
            <div key={i} className={`bar${isToday ? " today" : ""}`}>
              <div className="tip">{fmtUSD(d.spend)} · {d.label}</div>
              <div className="fill" style={{ height: `${hPct}%` }} />
            </div>
          );
        })}
      </div>
      <div className="axis" aria-hidden="true">
        {last14.map((d, i) => (
          <div key={i} className={i === last14.length - 1 ? "today" : ""}>
            {i % 2 === 0 || i === last14.length - 1 ? d.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function ByModel({
  modelRows,
  totalCost,
}: {
  modelRows: [string, { runs: number; tokens: number; cost: number; sub: string }][];
  totalCost: number;
}) {
  if (modelRows.length === 0) {
    return <div className="text-[12px] text-[var(--ao-fg-3)] py-2">No runs in this period.</div>;
  }
  return (
    <div className="model-rows">
      {modelRows.map(([id, m]) => {
        const pct = totalCost > 0 ? (m.cost / totalCost) * 100 : 0;
        const avg = m.runs > 0 ? m.cost / m.runs : 0;
        return (
          <div key={id} className="model-row">
            <div className="name">
              {id}
              <span className="sub">{m.sub}</span>
            </div>
            <div className="bar-wrap">
              <div className="bar" aria-label={`${pct.toFixed(0)}% of cost`}>
                <div className="fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="pct">{pct.toFixed(0)}%</span>
            </div>
            <div className="group">
              <span className="cell">{m.runs} runs</span>
              <span className="cell muted">{fmtTok(m.tokens)} tok</span>
            </div>
            <div className="group">
              <span className="cell">{fmtUSD(m.cost)}</span>
              <span className="cell muted">{fmtUSD(avg, 3)}/run</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopAgents({
  agentRows,
  totalCost,
}: {
  agentRows: [string, { runs: number; cost: number; name: string }][];
  totalCost: number;
}) {
  if (agentRows.length === 0) {
    return <div className="text-[12px] text-[var(--ao-fg-3)] py-2">No runs in this period.</div>;
  }
  return (
    <div className="spend-rows">
      {agentRows.map(([id, a], i) => {
        const pct = totalCost > 0 ? (a.cost / totalCost) * 100 : 0;
        const initial = (a.name || id).charAt(0).toUpperCase();
        return (
          <div key={id} className="spend-row">
            <div className="rank">#{i + 1}</div>
            <div className="agent-info">
              <div className="av" aria-hidden="true">{initial}</div>
              <div className="meta">
                <div className="id">{id}</div>
                <div className="runs">{a.runs} runs</div>
              </div>
            </div>
            <div className="right">
              <div className="bar" aria-label={`${pct.toFixed(0)}% of agent spend`}>
                <div className="fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="pct">{pct.toFixed(0)}%</span>
              <span className="cost">{fmtUSD(a.cost)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main modal                                                           */
/* ------------------------------------------------------------------ */

export function ClaudeLimitsModal() {
  useClaudeLimitsHydration();

  const open      = useClaudeLimitsStore((s) => s.open);
  const setOpen   = useClaudeLimitsStore((s) => s.setOpen);
  const plan      = useClaudeLimitsStore((s) => s.plan);
  const quotaUsd  = useClaudeLimitsStore((s) => s.quotaUsd);
  const period    = useClaudeLimitsStore((s) => s.period);
  const hardCap   = useClaudeLimitsStore((s) => s.hardCap);
  const update    = useClaudeLimitsStore((s) => s.update);

  // Local editable state — only written to store on Save
  const [localPlan,     setLocalPlan]     = useState<ClaudePlan>(plan);
  const [localQuota,    setLocalQuota]    = useState(quotaUsd);
  const [localPeriod,   setLocalPeriod]   = useState<LimitsPeriod>(period);
  const [localHardCap,  setLocalHardCap]  = useState<"off" | "warn" | "block">(hardCap);

  // Sync local state whenever the modal opens
  useEffect(() => {
    if (open) {
      setLocalPlan(plan);
      setLocalQuota(quotaUsd);
      setLocalPeriod(period);
      setLocalHardCap(hardCap);
    }
  }, [open, plan, quotaUsd, period, hardCap]);

  const onSave = () => {
    update({ plan: localPlan, quotaUsd: localQuota, period: localPeriod, hardCap: localHardCap });
    setOpen(false);
  };

  // ---- Data computation ----
  const runsQ = useRuns({ limit: 1000 });
  const allRuns = runsQ.data ?? [];

  const start = periodStart(localPeriod);
  const end   = periodEnd(localPeriod);

  const inPeriod = useMemo(
    () => allRuns.filter((r) => r.ts >= start && r.ts < end),
    [allRuns, start, end],
  );

  const spentPeriod = inPeriod.reduce((s, r) => s + (r.cost || 0), 0);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const spentToday = useMemo(
    () => allRuns.filter((r) => r.ts >= todayStart).reduce((s, r) => s + (r.cost || 0), 0),
    [allRuns, todayStart],
  );

  // Last 14 days bars
  const last14 = useMemo<{ label: string; spend: number }[]>(() =>
    Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const spend = allRuns
        .filter((r) => r.ts >= d.getTime() && r.ts < next.getTime())
        .reduce((s, r) => s + (r.cost || 0), 0);
      const label =
        i === 13
          ? "Today"
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { label, spend };
    }),
  [allRuns]);

  // By model (current period)
  const { modelRows, totalModelCost } = useMemo(() => {
    const byModel = new Map<string, { runs: number; tokens: number; cost: number; sub: string }>();
    for (const r of inPeriod) {
      const k = r.model || "unknown";
      const cur = byModel.get(k) ?? { runs: 0, tokens: 0, cost: 0, sub: k };
      byModel.set(k, {
        runs:   cur.runs + 1,
        tokens: cur.tokens + (r.tokensIn || 0) + (r.tokensOut || 0),
        cost:   cur.cost + (r.cost || 0),
        sub:    cur.sub,
      });
    }
    const rows = [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost);
    const total = rows.reduce((s, [, v]) => s + v.cost, 0);
    return { modelRows: rows, totalModelCost: total };
  }, [inPeriod]);

  // By agent (current period, top 6)
  const { agentRows, totalAgentCost } = useMemo(() => {
    const byAgent = new Map<string, { runs: number; cost: number; name: string }>();
    for (const r of inPeriod) {
      const k = r.agentId;
      const cur = byAgent.get(k) ?? { runs: 0, cost: 0, name: r.agentName || k };
      byAgent.set(k, { runs: cur.runs + 1, cost: cur.cost + (r.cost || 0), name: cur.name });
    }
    const rows = [...byAgent.entries()]
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 6);
    const total = rows.reduce((s, [, v]) => s + v.cost, 0);
    return { agentRows: rows, totalAgentCost: total };
  }, [inPeriod]);

  // Forecast (linear projection to end of period)
  const forecast = useMemo(() => {
    const periodMs  = end - start;
    const elapsedMs = Math.max(1, Date.now() - start);
    return spentPeriod * (periodMs / elapsedMs);
  }, [spentPeriod, start, end]);

  const resetIn = formatResetCountdown(end);

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      bareContent
      maxWidth={680}
      className="ao-modal"
      closeLabel="Close usage &amp; limits"
    >
          {/* Header */}
          <LimHeader onClose={() => setOpen(false)} />

          {/* Body */}
          <div className="limits-body">
            {/* Budget hero */}
            <BudgetHero
              spentPeriod={spentPeriod}
              spentToday={spentToday}
              quotaUsd={localQuota}
              period={localPeriod}
              forecast={forecast}
              resetIn={resetIn}
            />

            {/* Plan */}
            <section className="lim-section">
              <SectionHead title="Plan" sub="determines model access and rate limits" />
              <PlanGrid value={localPlan} />
            </section>

            {/* Quota cap + period */}
            <section className="lim-section">
              <SectionHead
                title="Quota cap"
                sub="hard limit on spend for the current period"
                right={<PeriodSeg value={localPeriod} onChange={setLocalPeriod} />}
              />
              <QuotaCap value={localQuota} onChange={setLocalQuota} />
            </section>

            {/* Behavior on cap */}
            <section className="lim-section">
              <SectionHead title="Behavior on cap" sub="what happens when usage hits the cap" />
              <BehaviorButtons value={localHardCap} onChange={setLocalHardCap} />
            </section>

            {/* Daily spend bars */}
            <section className="lim-section">
              <SectionHead title="Daily spend" sub="last 14 days" />
              <DailyBars last14={last14} />
            </section>

            {/* By model + top agents */}
            <div className="lim-two-col">
              <section className="lim-section">
                <SectionHead
                  title="By model"
                  sub={localPeriod === "daily" ? "today" : localPeriod === "month" ? "this month" : "this week"}
                />
                <ByModel modelRows={modelRows} totalCost={totalModelCost} />
              </section>
              <section className="lim-section">
                <SectionHead
                  title="Top agents"
                  sub={localPeriod === "daily" ? "today" : localPeriod === "month" ? "this month" : "this week"}
                />
                <TopAgents agentRows={agentRows} totalCost={totalAgentCost} />
              </section>
            </div>
          </div>

          {/* Footer */}
          <div className="limits-foot">
            <div className="disclaimer">
              <span className="icon" aria-hidden="true">ℹ</span>
              <span>
                Counts only what Agent Office summoned (saved in{" "}
                <code
                  className="text-[var(--ao-fg-1)] bg-[rgba(255,255,255,0.04)] px-1 py-px rounded-[3px]"
                >
                  ~/.claude/agent-office/db.sqlite
                </code>
                ). Anything you ran through plain{" "}
                <code
                  className="text-[var(--ao-fg-1)] bg-[rgba(255,255,255,0.04)] px-1 py-px rounded-[3px]"
                >
                  claude
                </code>{" "}
                outside the dashboard isn&apos;t included.
              </span>
            </div>
            <div className="actions">
              <button className="lim-btn ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="lim-btn primary" onClick={onSave}>
                <span aria-hidden="true">✓</span> Save limits
              </button>
            </div>
          </div>
    </ModalShell>
  );
}
