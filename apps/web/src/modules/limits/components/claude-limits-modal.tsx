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

function modelLabel(raw: string): { name: string; sub: string } {
  const exact: Record<string, { name: string; sub: string }> = {
    "sonnet":              { name: "Sonnet",       sub: "claude-sonnet-4" },
    "opus":                { name: "Opus",          sub: "claude-opus-4" },
    "haiku":               { name: "Haiku",         sub: "claude-haiku-4" },
    "default":             { name: "Unknown",       sub: "model not captured" },
    "unknown":             { name: "Unknown",       sub: "model not captured" },
  };
  if (exact[raw]) return exact[raw];
  // claude-{family}-{version} full IDs → e.g. "claude-opus-4-7" → "Opus 4.7"
  const m = raw.match(/^claude-([a-z]+)-([\d]+)(?:-([\d]+))?/i);
  if (m) {
    const family = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1);
    const ver = m[3] ? `${m[2]}.${m[3]}` : m[2]!;
    return { name: `${family} ${ver}`, sub: raw };
  }
  return { name: raw, sub: raw };
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
    <div className="flex items-center gap-2">
      <span className="w-[3px] h-[14px] bg-ao-accent rounded-full shrink-0" />
      <h3 className="text-[12.5px] font-semibold text-ao-fg-0 m-0">{title}</h3>
      {sub && <span className="text-[11px] text-ao-fg-3 font-mono">{sub}</span>}
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

function LimHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--ao-line-0)] shrink-0">
      <div className="w-8 h-8 bg-ao-accent-soft border border-ao-accent-line rounded-[8px] grid place-items-center text-ao-accent text-[15px]" aria-hidden="true">⚡</div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-ao-fg-0">Usage &amp; limits</div>
        <div className="text-[11px] text-ao-fg-3 font-mono mt-[1px]">spend caps, plan, and per-model breakdown · workspace local</div>
      </div>
      <button
        className="w-7 h-7 rounded-[6px] grid place-items-center text-ao-fg-3 text-[16px] leading-none transition-[background,color] duration-[120ms] hover:bg-ao-bg-3 hover:text-ao-fg-0 border-0 bg-transparent cursor-pointer p-0"
        aria-label="Close"
        onClick={onClose}
      >×</button>
    </div>
  );
}

function PlanGrid({ value }: { value: ClaudePlan }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PLAN_DEFS.map((p) => (
        <div
          key={p.id}
          className={`flex flex-col gap-1 p-3 rounded-ao-md bg-ao-bg-2 border text-left cursor-default pointer-events-none transition-[border-color,background] duration-[120ms] ${value === p.id ? "border-[var(--ao-accent-line)] bg-[var(--ao-accent-softer)]" : "border-ao-line-1"}`}
        >
          <div className="flex items-center gap-[6px] text-[13px] font-semibold text-ao-fg-0">
            <span className="w-[22px] h-[22px] bg-ao-bg-3 border border-ao-line-1 rounded-[6px] inline-grid place-items-center text-[11px] font-mono shrink-0">
              {p.icon}
            </span>
            {p.name}
            {value === p.id && <span className="ml-auto w-4 h-4 rounded-full border border-ao-accent grid place-items-center text-[10px] text-ao-accent" aria-hidden="true">✓</span>}
          </div>
          <div className="text-[11px] text-ao-accent font-mono font-semibold">{p.price}</div>
          <div className="text-[10.5px] text-ao-fg-3 leading-[1.4]">{p.feat}</div>
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
    <div className="flex gap-0.5 bg-ao-bg-3 border border-ao-line-1 rounded-[8px] p-[3px]" role="group" aria-label="Reset period">
      {opts.map((o) => (
        <button
          key={o.id}
          className={`flex-1 px-[10px] py-[5px] rounded-[6px] text-[12px] transition-[background,color] duration-[120ms] border-0 cursor-pointer ${value === o.id ? "bg-ao-bg-1 text-ao-fg-0 shadow-[0_1px_3px_rgba(0,0,0,0.3)]" : "bg-transparent text-ao-fg-2 hover:text-ao-fg-1"}`}
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
    <div className="flex flex-wrap gap-[6px] items-center">
      {CAP_PRESETS.map((p) => (
        <button
          key={p}
          className={`px-3 py-[6px] rounded-full font-mono text-[12.5px] transition-[border-color,background,color] duration-[120ms] border cursor-pointer ${value === p ? "border-[var(--ao-accent-line)] bg-[var(--ao-accent-softer)] text-ao-fg-0" : "bg-ao-bg-2 border-ao-line-1 text-ao-fg-1 hover:bg-ao-bg-3"}`}
          onClick={() => onChange(p)}
          aria-pressed={value === p}
        >
          {p === 0 ? (
            <>Off <span className="text-ao-fg-3">· track only</span></>
          ) : (
            <><span className="text-ao-fg-3">$</span>{p}</>
          )}
        </button>
      ))}
      <span className="flex items-center gap-1 bg-ao-bg-2 border border-ao-line-1 rounded-full px-[10px] py-1 text-[12.5px] font-mono focus-within:border-ao-accent-line">
        <span className="text-ao-fg-3" aria-hidden="true">$</span>
        <input
          type="number"
          placeholder="custom"
          aria-label="Custom cap amount in USD"
          value={isPreset ? "" : value || ""}
          min="0"
          step="1"
          className="bg-transparent border-none outline-none w-[60px] text-ao-fg-0 font-[inherit] text-[inherit] placeholder:text-ao-fg-3"
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
    <div className="flex gap-2" role="group" aria-label="Behavior on cap">
      {opts.map((o) => (
        <button
          key={o.id}
          className={`flex-1 px-3 py-[10px] rounded-ao-md text-left transition-[border-color,background] duration-[120ms] cursor-pointer border ${value === o.id ? "border-[var(--ao-accent-line)] bg-[var(--ao-accent-softer)]" : "bg-ao-bg-2 border-ao-line-1 hover:bg-ao-bg-3"}`}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
        >
          <div className="text-[12.5px] font-semibold text-ao-fg-0 flex items-center gap-[5px] mb-[3px]"><span aria-hidden="true">{o.icon}</span> {o.title}</div>
          <div className="text-[11px] text-ao-fg-3 leading-[1.4]">{o.desc}</div>
        </button>
      ))}
    </div>
  );
}

const CHART_H = 60; // fixed pixel height for the bar area

function DailyBars({ last14 }: { last14: { label: string; spend: number }[] }) {
  const max = Math.max(...last14.map((d) => d.spend), 0.01);
  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex gap-[3px]" style={{ height: CHART_H }} role="img" aria-label="Last 14 days of spend">
        {last14.map((d, i) => {
          const isToday = i === last14.length - 1;
          const barPx = d.spend > 0 ? Math.max(4, Math.round((d.spend / max) * CHART_H)) : 0;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end relative cursor-default group/bar"
              style={{ height: CHART_H }}
            >
              {d.spend > 0 && (
                <div className="absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 hidden group-hover/bar:flex bg-ao-bg-4 border border-ao-line-2 rounded-[6px] px-[8px] py-[5px] text-[10.5px] whitespace-nowrap text-ao-fg-1 font-mono z-10 pointer-events-none gap-[4px]">
                  <span className="text-ao-fg-0">{fmtUSD(d.spend)}</span>
                  <span className="text-ao-fg-3">·</span>
                  <span>{d.label}</span>
                </div>
              )}
              {barPx > 0 ? (
                <div
                  className={`w-full rounded-[2px_2px_0_0] transition-[background] duration-[100ms] ${isToday ? "bg-ao-accent" : "bg-ao-fg-2 group-hover/bar:bg-ao-fg-0"}`}
                  style={{ height: barPx }}
                />
              ) : (
                <div className={`w-full h-[2px] ${isToday ? "bg-ao-accent opacity-30" : "bg-ao-line-2"}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex text-[9.5px] text-ao-fg-3 font-mono" aria-hidden="true">
        {last14.map((d, i) => (
          <div key={i} className={`flex-1 text-center overflow-hidden ${i === last14.length - 1 ? "text-ao-accent" : ""}`}>
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
  modelRows: [string, { runs: number; tokens: number; cost: number }][];
  totalCost: number;
}) {
  if (modelRows.length === 0) {
    return <div className="text-[12px] text-ao-fg-3 py-2">No runs in this period.</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      {modelRows.map(([id, m]) => {
        const pct = totalCost > 0 ? (m.cost / totalCost) * 100 : 0;
        const avg = m.runs > 0 ? m.cost / m.runs : 0;
        const label = modelLabel(id);
        return (
          <div key={id} className="grid gap-2 items-center" style={{ gridTemplateColumns: "90px 1fr auto auto" }}>
            <div className="text-[12px] font-semibold text-ao-fg-0 font-mono">
              {label.name}
              <span className="block text-[10px] text-ao-fg-3 font-normal">{label.sub}</span>
            </div>
            <div className="flex items-center gap-[6px]">
              <div className="flex-1 h-[5px] bg-ao-bg-3 rounded-full overflow-hidden" aria-label={`${pct.toFixed(0)}% of cost`}>
                <div className="h-full bg-ao-accent rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-ao-fg-3 font-mono min-w-[28px] text-right">{pct.toFixed(0)}%</span>
            </div>
            <div className="flex flex-col items-end gap-[1px]">
              <span className="text-[11px] font-mono text-ao-fg-0">{m.runs} runs</span>
              <span className="text-[10px] font-mono text-ao-fg-3">{fmtTok(m.tokens)} tok</span>
            </div>
            <div className="flex flex-col items-end gap-[1px]">
              <span className="text-[11px] font-mono text-ao-fg-0">{fmtUSD(m.cost)}</span>
              <span className="text-[10px] font-mono text-ao-fg-3">{fmtUSD(avg, 3)}/run</span>
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
    return <div className="text-[12px] text-ao-fg-3 py-2">No runs in this period.</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      {agentRows.map(([id, a], i) => {
        const pct = totalCost > 0 ? (a.cost / totalCost) * 100 : 0;
        const initial = (a.name || id).charAt(0).toUpperCase();
        return (
          <div key={id} className="flex items-center gap-2">
            <div className="text-[10px] text-ao-fg-3 font-mono w-5 text-right shrink-0">#{i + 1}</div>
            <div className="flex items-center gap-[6px] min-w-0 w-[100px] shrink-0">
              <div className="w-[22px] h-[22px] rounded-[6px] bg-ao-bg-3 border border-ao-line-1 grid place-items-center text-[11px] font-bold text-ao-fg-1 shrink-0 font-mono" aria-hidden="true">{initial}</div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-ao-fg-0 overflow-hidden text-ellipsis whitespace-nowrap">{id}</div>
                <div className="text-[9.5px] text-ao-fg-3">{a.runs} runs</div>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-[6px] min-w-0">
              <div className="flex-1 h-[5px] bg-ao-bg-3 rounded-full overflow-hidden" aria-label={`${pct.toFixed(0)}% of agent spend`}>
                <div className="h-full bg-ao-accent rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-ao-fg-3 font-mono min-w-[28px] text-right shrink-0">{pct.toFixed(0)}%</span>
              <span className="text-[11px] font-mono text-ao-fg-0 min-w-[42px] text-right shrink-0">{fmtUSD(a.cost)}</span>
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

  // Local editable state for user-configurable fields only (plan is read-only from credentials)
  const [localQuota,    setLocalQuota]    = useState(quotaUsd);
  const [localPeriod,   setLocalPeriod]   = useState<LimitsPeriod>(period);
  const [localHardCap,  setLocalHardCap]  = useState<"off" | "warn" | "block">(hardCap);

  // Sync local state whenever the modal opens
  useEffect(() => {
    if (open) {
      setLocalQuota(quotaUsd);
      setLocalPeriod(period);
      setLocalHardCap(hardCap);
    }
  }, [open, quotaUsd, period, hardCap]);

  const onSave = () => {
    update({ quotaUsd: localQuota, period: localPeriod, hardCap: localHardCap });
    setOpen(false);
  };

  // ---- Data computation ----
  const runsQ = useRuns({ limit: 500 });
  const allRuns = runsQ.data ?? [];

  const start = periodStart(localPeriod);
  const end   = periodEnd(localPeriod);

  const inPeriod = useMemo(
    () => allRuns.filter((r) => r.ts >= start && r.ts < end),
    [allRuns, start, end],
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
    const byModel = new Map<string, { runs: number; tokens: number; cost: number }>();
    for (const r of inPeriod) {
      const k = r.model || "unknown";
      const cur = byModel.get(k) ?? { runs: 0, tokens: 0, cost: 0 };
      byModel.set(k, {
        runs:   cur.runs + 1,
        tokens: cur.tokens + (r.tokensIn || 0) + (r.tokensOut || 0),
        cost:   cur.cost + (r.cost || 0),
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
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-5 flex flex-col gap-6 [scrollbar-width:thin] [scrollbar-color:var(--ao-bg-4)_transparent]">
            {/* By model + top agents */}
            <div className="grid grid-cols-2 gap-4">
              <section className="flex flex-col gap-3">
                <SectionHead
                  title="By model"
                  sub={localPeriod === "daily" ? "today" : localPeriod === "month" ? "this month" : "this week"}
                />
                <ByModel modelRows={modelRows} totalCost={totalModelCost} />
              </section>
              <section className="flex flex-col gap-3">
                <SectionHead
                  title="Top agents"
                  sub={localPeriod === "daily" ? "today" : localPeriod === "month" ? "this month" : "this week"}
                />
                <TopAgents agentRows={agentRows} totalCost={totalAgentCost} />
              </section>
            </div>

            {/* Plan */}
            <section className="flex flex-col gap-3">
              <SectionHead title="Plan" sub="determines model access and rate limits" />
              <PlanGrid value={plan} />
            </section>

            {/* Quota cap + period */}
            <section className="flex flex-col gap-3">
              <SectionHead
                title="Quota cap"
                sub="hard limit on spend for the current period"
                right={<PeriodSeg value={localPeriod} onChange={setLocalPeriod} />}
              />
              <QuotaCap value={localQuota} onChange={setLocalQuota} />
            </section>

            {/* Behavior on cap */}
            <section className="flex flex-col gap-3">
              <SectionHead title="Behavior on cap" sub="what happens when usage hits the cap" />
              <BehaviorButtons value={localHardCap} onChange={setLocalHardCap} />
            </section>

            {/* Daily spend bars */}
            <section className="flex flex-col gap-3">
              <SectionHead title="Daily spend" sub="last 14 days" />
              <DailyBars last14={last14} />
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-end gap-4 px-5 py-[14px] border-t border-[var(--ao-line-0)] shrink-0">
            <div className="flex-1 text-[11px] text-ao-fg-3 leading-[1.55] flex gap-[6px]">
              <span className="text-ao-fg-3 shrink-0 mt-[1px] text-[12px]" aria-hidden="true">ℹ</span>
              <span>
                Counts only what Agent Office summoned (saved in{" "}
                <code className="text-ao-fg-1 bg-white/[0.04] px-1 py-px rounded-[3px]">
                  ~/.claude/agent-office/db.sqlite
                </code>
                ). Anything you ran through plain{" "}
                <code className="text-ao-fg-1 bg-white/[0.04] px-1 py-px rounded-[3px]">
                  claude
                </code>{" "}
                outside the dashboard isn&apos;t included.
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                className="px-[14px] py-[7px] rounded-[8px] text-[12.5px] font-medium cursor-pointer transition-[background,border-color] duration-[120ms] bg-transparent border border-ao-line-2 text-ao-fg-1 hover:bg-ao-bg-3"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-[14px] py-[7px] rounded-[8px] text-[12.5px] font-medium cursor-pointer transition-[background,border-color] duration-[120ms] bg-ao-accent border border-transparent text-white flex items-center gap-[5px] hover:opacity-90"
                onClick={onSave}
              >
                <span aria-hidden="true">✓</span> Save limits
              </button>
            </div>
          </div>
    </ModalShell>
  );
}
