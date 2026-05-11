"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useRuns } from "@/modules/runs/hooks/use-runs";

export function HistoryTab({ agentId }: { agentId: string }) {
  const t = useTranslations();
  const runsQ = useRuns({ agentId, limit: 50 });
  const runs = runsQ.data ?? [];
  const totalCost = runs.reduce((s, r) => s + (r.cost || 0), 0);

  const relTime = (ts: number): string => {
    const diff = Date.now() - ts;
    const m = Math.round(diff / 60000);
    if (m < 1) return t("agent_details.history_rel_just_now");
    if (m < 60) return t("agent_details.history_rel_minutes", { n: m });
    const h = Math.round(m / 60);
    if (h < 24) return t("agent_details.history_rel_hours", { n: h });
    const d = Math.round(h / 24);
    return t("agent_details.history_rel_days", { n: d });
  };

  if (runsQ.isLoading) {
    return (
      <div className="tab-pane" style={{ padding: 18 }}>
        <Skeleton width="100%" height={180} />
      </div>
    );
  }

  return (
    <div className="tab-pane" style={{ padding: 18, overflow: "auto" }}>
      <div className="card">
        <div className="card-h">
          <span className="title">{t("agent_details.history_card_title")}</span>
          <span className="sub">
            {t("agent_details.history_card_sub", { count: runs.length, total: totalCost.toFixed(3) })}
          </span>
        </div>
        {runs.length === 0 ? (
          <div style={{ padding: 18, fontSize: 13, color: "var(--txt-3)" }}>
            {t("agent_details.history_empty")}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-2)", color: "var(--txt-3)" }}>
                <th style={TH}>{t("agent_details.history_col_run")}</th>
                <th style={TH}>{t("agent_details.history_col_prompt")}</th>
                <th style={TH}>{t("agent_details.history_col_when")}</th>
                <th style={TH}>{t("agent_details.history_col_duration")}</th>
                <th style={TH}>{t("agent_details.history_col_tokens")}</th>
                <th style={TH}>{t("agent_details.history_col_cost")}</th>
                <th style={TH}>{t("agent_details.history_col_outcome")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const outcome = r.status === "done" ? t("agent_details.history_outcome_completed") : r.status;
                const ok = r.status === "done";
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={TD_MONO}>{r.id.slice(0, 8)}</td>
                    <td style={TD}>
                      <span title={r.prompt}>{trim(r.prompt, 56)}</span>
                    </td>
                    <td style={TD_MONO}>{relTime(r.ts)}</td>
                    <td style={TD_MONO}>{(r.durMs / 1000).toFixed(1)}s</td>
                    <td style={TD_MONO}>{(r.tokensIn + r.tokensOut).toLocaleString()}</td>
                    <td style={TD_MONO}>${r.cost.toFixed(3)}</td>
                    <td style={TD}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: ok
                            ? "rgba(14,132,32,0.10)"
                            : "rgba(199,22,43,0.10)",
                          color: ok ? "var(--done)" : "var(--error)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {outcome}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
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
const TD_MONO: React.CSSProperties = { ...TD, fontFamily: "var(--font-mono)", fontSize: 12 };

function trim(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
