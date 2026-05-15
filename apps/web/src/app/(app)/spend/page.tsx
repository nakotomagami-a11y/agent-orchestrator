"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRuns } from "@/modules/runs/hooks/use-runs";
import { Skeleton } from "@/components/ui/skeleton";

export default function SpendPage() {
  const t = useTranslations("spend_page");
  const runsQ = useRuns({ limit: 1000 });
  const runs = runsQ.data ?? [];

  const { days, agentRows } = useMemo(() => {
    // Build last 14 days array (oldest first)
    const todayMs = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();

    const daySlots: Array<{ isoDate: string; label: string; cost: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayMs - i * 86_400_000);
      const isoDate = d.toISOString().slice(0, 10);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      daySlots.push({ isoDate, label, cost: 0 });
    }

    const slotMap = new Map(daySlots.map((s, idx) => [s.isoDate, idx]));
    const cutoff = todayMs - 13 * 86_400_000;

    // Per-agent buckets
    const agentMap = new Map<
      string,
      { name: string; runs: number; tokensIn: number; tokensOut: number; cost: number }
    >();

    for (const r of runs) {
      if (r.ts < cutoff) continue;
      const d = new Date(r.ts);
      d.setHours(0, 0, 0, 0);
      const iso = d.toISOString().slice(0, 10);
      const idx = slotMap.get(iso);
      if (idx !== undefined) {
        daySlots[idx]!.cost += r.cost ?? 0;
      }
      // agent row
      const key = r.agentId;
      const bucket = agentMap.get(key) ?? {
        name: r.agentName,
        runs: 0,
        tokensIn: 0,
        tokensOut: 0,
        cost: 0,
      };
      bucket.runs += 1;
      bucket.tokensIn += r.tokensIn ?? 0;
      bucket.tokensOut += r.tokensOut ?? 0;
      bucket.cost += r.cost ?? 0;
      agentMap.set(key, bucket);
    }

    const agentRows = Array.from(agentMap.values()).sort((a, b) => b.cost - a.cost);
    return { days: daySlots, agentRows };
  }, [runs]);

  const maxCost = Math.max(...days.map((d) => d.cost), 0.000001);
  const totalCost = days.reduce((s, d) => s + d.cost, 0);

  return (
    <div className="tab-pane flex flex-col gap-5">
      <div className="flex items-baseline gap-2.5">
        <h1 className="m-0 text-lg font-bold tracking-[-0.01em]">
          {t("title")}
        </h1>
        {!runsQ.isLoading && (
          <span className="font-mono text-xs text-txt-3">
            14d · ${totalCost.toFixed(3)}
          </span>
        )}
      </div>

      {runsQ.isLoading ? (
        <Skeleton width="100%" height={120} />
      ) : runsQ.data?.length === 0 ? (
        <div className="py-8 text-center text-[13px] text-txt-3">
          {t("no_data")}
        </div>
      ) : (
        <>
          {/* ── 14-day bar chart ── */}
          <div className="card p-4">
            <SectionLabel label="14-day spend" />
            <div
              className="flex items-end gap-[3px] h-20 mt-2"
              role="img"
              aria-label="14-day spend bar chart"
            >
              {days.map((day) => {
                const heightPct = day.cost > 0 ? (day.cost / maxCost) * 100 : 0;
                const heightPx = Math.max(day.cost > 0 ? 2 : 0, (heightPct / 100) * 80);
                return (
                  <div
                    key={day.isoDate}
                    className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                  >
                    <div
                      title={`${day.label}: $${day.cost.toFixed(4)}`}
                      className="w-full [border-radius:2px_2px_0_0] [transition:height_200ms_ease]"
                      style={{
                        height: heightPx,
                        background: day.cost > 0 ? "var(--acc)" : "var(--bg-3)",
                      }}
                    />
                    <span className="text-[9px] font-mono text-txt-4 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Per-agent leaderboard ── */}
          {agentRows.length > 0 && (
            <div className="card">
              <div className="card-h">
                <SectionLabel label="By agent" inline />
              </div>
              <table
                className="w-full border-collapse text-[12.5px]"
                aria-label="Spend by agent"
              >
                <thead>
                  <tr className="bg-bg-2 text-txt-3">
                    <th className="text-left px-[14px] py-[10px] text-[11px] uppercase tracking-[0.05em] font-semibold">{t("col_agent")}</th>
                    <th className="text-right px-[14px] py-[10px] text-[11px] uppercase tracking-[0.05em] font-semibold">{t("col_runs")}</th>
                    <th className="text-right px-[14px] py-[10px] text-[11px] uppercase tracking-[0.05em] font-semibold">{t("col_tokens")}</th>
                    <th className="text-right px-[14px] py-[10px] text-[11px] uppercase tracking-[0.05em] font-semibold">{t("col_cost")}</th>
                  </tr>
                </thead>
                <tbody>
                  {agentRows.map((row) => (
                    <tr
                      key={row.name}
                      className="border-b border-line"
                    >
                      <td className="px-[14px] py-[10px] text-[13px]">
                        <span className="font-semibold font-mono">
                          {row.name}
                        </span>
                      </td>
                      <td className="px-[14px] py-[10px] text-xs font-mono text-right">{row.runs}</td>
                      <td className="px-[14px] py-[10px] text-xs font-mono text-right">
                        {(row.tokensIn + row.tokensOut).toLocaleString()}
                      </td>
                      <td className="px-[14px] py-[10px] text-xs font-mono text-right">
                        ${row.cost.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SectionLabel({ label, inline }: { label: string; inline?: boolean }) {
  return (
    <span
      className={`text-[11px] text-txt-3 font-mono uppercase tracking-[0.06em] font-semibold${inline ? " inline" : " block"}`}
    >
      {label}
    </span>
  );
}
