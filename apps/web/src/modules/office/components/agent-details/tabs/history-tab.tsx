"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useRuns } from "@/modules/runs/hooks/use-runs";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";
import {
  AoSearch, AoFilter, AoChevronRight, AoSparkle, AoDown, AoTrash,
} from "@/modules/summon/components/ao-icons";

function fmtDur(ms: number): string {
  if (!ms) return "—";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function fmtTok(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function HistoryTab({ agentId }: { agentId: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "ok" | "bad">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const qc = useQueryClient();

  // Don't filter by instanceId — standalone agents always store runs as
  // instance_id="default" regardless of the UI's selectedInstanceId.
  const runsQ = useRuns({ agentId, limit: 200 });

  const wipeMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/runs?agent=${encodeURIComponent(agentId)}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.runs.all });
      setConfirmWipe(false);
    },
  });
  const allRuns = runsQ.data ?? [];

  if (runsQ.isLoading) {
    return (
      <div className="ao-tab-pane">
        <Skeleton width="100%" height={180} />
      </div>
    );
  }

  const totalCost = allRuns.reduce((s, r) => s + (r.cost || 0), 0);
  const totalTokens = allRuns.reduce((s, r) => s + (r.tokensIn || 0) + (r.tokensOut || 0), 0);
  const successRate = allRuns.length
    ? Math.round(100 * allRuns.filter((r) => r.status === "done").length / allRuns.length)
    : 0;

  const filtered = allRuns.filter((r) => {
    if (filter === "ok" && r.status !== "done") return false;
    if (filter === "bad" && r.status === "done") return false;
    if (q && !`${r.agentId} ${r.prompt}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  // Group by calendar day
  const groups: { day: string; runs: typeof filtered }[] = [];
  for (const r of filtered) {
    const day = dayLabel(r.ts);
    let g = groups.find((x) => x.day === day);
    if (!g) { g = { day, runs: [] }; groups.push(g); }
    g.runs.push(r);
  }

  return (
    <div className="ao-tab-pane">
      {/* Stats row */}
      <div className="ao-history-stats">
        <div className="ao-stat">
          <div className="ao-label">Total runs</div>
          <div className="ao-value">{allRuns.length}</div>
        </div>
        <div className="ao-stat">
          <div className="ao-label">Tokens used</div>
          <div className="ao-value">{fmtTok(totalTokens)}</div>
        </div>
        <div className="ao-stat">
          <div className="ao-label">Spend</div>
          <div className="ao-value">${totalCost.toFixed(3)}</div>
        </div>
        <div className="ao-stat">
          <div className="ao-label">Success rate</div>
          <div className="ao-value">
            {successRate}%
            <span className={`ao-delta${successRate < 90 && allRuns.length > 0 ? " ao-bad" : ""}`}>
              {allRuns.length === 0 ? "" : successRate >= 90 ? "good" : "watch"}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="ao-history-toolbar">
        <div className="ao-search-input">
          <AoSearch size={14} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search prompts, run IDs…"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear" className="text-[var(--ao-fg-3)] leading-none text-base">
              ×
            </button>
          )}
        </div>
        <button type="button" className={`ao-filter-btn${filter === "all" ? " ao-active" : ""}`} onClick={() => setFilter("all")}>
          All
        </button>
        <button type="button" className={`ao-filter-btn${filter === "ok" ? " ao-active" : ""}`} onClick={() => setFilter("ok")}>
          <span className="ao-badge ao-ok ao-dot text-[9px] px-[6px] py-px">ok</span>
        </button>
        <button type="button" className={`ao-filter-btn${filter === "bad" ? " ao-active" : ""}`} onClick={() => setFilter("bad")}>
          <span className="ao-badge ao-bad ao-dot text-[9px] px-[6px] py-px">failed</span>
        </button>
        <div className="flex-1" />
        {confirmWipe ? (
          <div className="flex items-center gap-[6px]">
            <span className="text-xs text-[var(--ao-fg-2)]">Wipe all runs?</span>
            <button
              type="button"
              className="ao-filter-btn text-[var(--ao-bad)] border-[var(--ao-bad)]"
              onClick={() => wipeMutation.mutate()}
              disabled={wipeMutation.isPending}
            >
              {wipeMutation.isPending ? "Wiping…" : "Yes, wipe"}
            </button>
            <button type="button" className="ao-filter-btn" onClick={() => setConfirmWipe(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="ao-filter-btn text-[var(--ao-fg-3)]"
            onClick={() => setConfirmWipe(true)}
            disabled={allRuns.length === 0}
          >
            <AoTrash size={13} /> Wipe
          </button>
        )}
      </div>

      {/* Run list */}
      {groups.length === 0 ? (
        <div className="ao-card">
          <div className="ao-card-body !text-center !p-10 !text-[var(--ao-fg-2)]">
            <AoSearch size={28} />
            <div className="mt-[10px] text-sm">
              {allRuns.length === 0 ? "No runs yet." : "No runs match your filter."}
            </div>
          </div>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.day} className="ao-day-group">
            <div className="ao-day-header">
              <span>{g.day}</span>
              <span className="ao-runs">{g.runs.length} {g.runs.length === 1 ? "run" : "runs"}</span>
              <span className="ao-line" />
              <span className="ao-mono">
                ${g.runs.reduce((s, r) => s + (r.cost || 0), 0).toFixed(3)} · {fmtTok(g.runs.reduce((s, r) => s + (r.tokensIn || 0) + (r.tokensOut || 0), 0))}
              </span>
            </div>
            {g.runs.map((r) => (
              <div key={r.id}>
                <div
                  className={`ao-run-row${openId === r.id ? " ao-open" : ""}`}
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                >
                  <span className={`ao-status-dot${r.status === "done" ? " ao-ok" : r.status === "error" ? " ao-bad" : ""}`} />
                  <div className="ao-main">
                    <div className="ao-agent">
                      <span>{r.agentName || r.agentId}</span>
                      <span className="ao-agent-tag">{r.id.slice(0, 8)}</span>
                    </div>
                    <div className="ao-prompt">{r.prompt}</div>
                  </div>
                  <span className="ao-cell ao-muted">{fmtDur(r.durMs)}</span>
                  <span className="ao-cell">
                    {fmtTok((r.tokensIn || 0) + (r.tokensOut || 0))}
                    <span className="ao-muted"> tok</span>
                  </span>
                  <span className="ao-cell">${(r.cost || 0).toFixed((r.cost || 0) < 0.1 ? 3 : 2)}</span>
                  <span className="ao-cell ao-muted">{relTime(r.ts)}</span>
                  <span className="ao-chev"><AoDown size={14} /></span>
                </div>
                {openId === r.id && (
                  <div className="ao-run-detail">
                    <div className="ao-panel">
                      <div className="ao-head"><AoChevronRight size={11} /> prompt</div>
                      <div className="ao-body">{r.prompt}</div>
                    </div>
                    <div className="ao-panel">
                      <div className="ao-head"><AoSparkle size={11} /> response</div>
                      <div className="ao-body">{r.output || "—"}</div>
                    </div>
                    <div className="ao-meta-row">
                      <div className="ao-meta">
                        <div className="ao-lbl">run id</div>
                        <div className="ao-val">{r.id}</div>
                      </div>
                      <div className="ao-meta">
                        <div className="ao-lbl">duration</div>
                        <div className="ao-val">{fmtDur(r.durMs)}</div>
                      </div>
                      <div className="ao-meta">
                        <div className="ao-lbl">tokens</div>
                        <div className="ao-val">{fmtTok((r.tokensIn || 0) + (r.tokensOut || 0))}</div>
                      </div>
                      <div className="ao-meta">
                        <div className="ao-lbl">cost</div>
                        <div className="ao-val">${(r.cost || 0).toFixed(4)}</div>
                      </div>
                      <div className="ao-meta">
                        <div className="ao-lbl">model</div>
                        <div className="ao-val">{r.model || "—"}</div>
                      </div>
                      <div className="ao-meta">
                        <div className="ao-lbl">status</div>
                        <div className="ao-val">
                          <span className={`ao-badge ${r.status === "done" ? "ao-ok" : "ao-bad"}`}>
                            {r.status === "done" ? "completed" : r.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
