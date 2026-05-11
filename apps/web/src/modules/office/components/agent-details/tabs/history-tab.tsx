"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useRuns } from "@/modules/runs/hooks/use-runs";

export function HistoryTab({ agentId }: { agentId: string }) {
  const runsQ = useRuns({ agentId, limit: 50 });
  const runs = runsQ.data ?? [];
  const totalCost = runs.reduce((s, r) => s + (r.cost || 0), 0);

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
          <span className="title">History</span>
          <span className="sub">
            {runs.length} run{runs.length === 1 ? "" : "s"} · ${totalCost.toFixed(3)} total
          </span>
        </div>
        {runs.length === 0 ? (
          <div style={{ padding: 18, fontSize: 13, color: "var(--txt-3)" }}>
            No runs yet — start a conversation in the Conversation tab.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-2)", color: "var(--txt-3)" }}>
                <th style={TH}>Run</th>
                <th style={TH}>Prompt</th>
                <th style={TH}>When</th>
                <th style={TH}>Duration</th>
                <th style={TH}>Tokens</th>
                <th style={TH}>Cost</th>
                <th style={TH}>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const outcome = r.status === "done" ? "completed" : r.status;
                const ok = outcome === "completed";
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

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
