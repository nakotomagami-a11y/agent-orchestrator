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
    <div className="tab-pane" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
          {t("title")}
        </h1>
        {!runsQ.isLoading && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--txt-3)",
            }}
          >
            14d · ${totalCost.toFixed(3)}
          </span>
        )}
      </div>

      {runsQ.isLoading ? (
        <Skeleton width="100%" height={120} />
      ) : runsQ.data?.length === 0 ? (
        <div
          style={{
            padding: "32px 0",
            textAlign: "center",
            fontSize: 13,
            color: "var(--txt-3)",
          }}
        >
          {t("no_data")}
        </div>
      ) : (
        <>
          {/* ── 14-day bar chart ── */}
          <div className="card" style={{ padding: 16 }}>
            <SectionLabel label="14-day spend" />
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 3,
                height: 80,
                marginTop: 8,
              }}
              role="img"
              aria-label="14-day spend bar chart"
            >
              {days.map((day) => {
                const heightPct = day.cost > 0 ? (day.cost / maxCost) * 100 : 0;
                const heightPx = Math.max(day.cost > 0 ? 2 : 0, (heightPct / 100) * 80);
                return (
                  <div
                    key={day.isoDate}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      height: "100%",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      title={`${day.label}: $${day.cost.toFixed(4)}`}
                      style={{
                        width: "100%",
                        height: heightPx,
                        background: day.cost > 0 ? "var(--acc)" : "var(--bg-3)",
                        borderRadius: "2px 2px 0 0",
                        transition: "height 200ms ease",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: "var(--font-mono)",
                        color: "var(--txt-4)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                      }}
                    >
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
                style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}
                aria-label="Spend by agent"
              >
                <thead>
                  <tr style={{ background: "var(--bg-2)", color: "var(--txt-3)" }}>
                    <th style={TH}>{t("col_agent")}</th>
                    <th style={{ ...TH, textAlign: "right" }}>{t("col_runs")}</th>
                    <th style={{ ...TH, textAlign: "right" }}>{t("col_tokens")}</th>
                    <th style={{ ...TH, textAlign: "right" }}>{t("col_cost")}</th>
                  </tr>
                </thead>
                <tbody>
                  {agentRows.map((row) => (
                    <tr
                      key={row.name}
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      <td style={TD}>
                        <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                          {row.name}
                        </span>
                      </td>
                      <td style={{ ...TD_MONO, textAlign: "right" }}>{row.runs}</td>
                      <td style={{ ...TD_MONO, textAlign: "right" }}>
                        {(row.tokensIn + row.tokensOut).toLocaleString()}
                      </td>
                      <td style={{ ...TD_MONO, textAlign: "right" }}>
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
      style={{
        fontSize: 11,
        color: "var(--txt-3)",
        fontFamily: "var(--font-mono)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 600,
        display: inline ? "inline" : "block",
        marginBottom: inline ? 0 : 0,
      }}
    >
      {label}
    </span>
  );
}

const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontWeight: 600,
};
const TD: React.CSSProperties = { padding: "10px 14px", fontSize: 13 };
const TD_MONO: React.CSSProperties = {
  ...TD,
  fontFamily: "var(--font-mono)",
  fontSize: 12,
};
