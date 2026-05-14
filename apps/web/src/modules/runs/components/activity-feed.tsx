"use client";

import { useState, useMemo, Fragment } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import type { PersistedRun } from "@agent-office/shared/types";
import { useRuns } from "../hooks/use-runs";
import {
  formatCost,
  formatDuration,
  formatRelative,
  dayLabel,
  groupRunsByDay,
} from "../utils/format-run-meta";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtTok(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

function isoDay(ts: number): string {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return isoDay(Date.now());
}

function yesterdayIso(): string {
  return isoDay(Date.now() - 86_400_000);
}

function agentInitial(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function elapsedSince(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

// ── Spark ─────────────────────────────────────────────────────────────────────

function Spark({
  data,
  color = "currentColor",
  width = 70,
  height = 34,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = Math.max(max - min, 0.0001);
  const stepX = width / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M ${pts[0]} L ${pts.slice(1).join(" ")}`;
  const area = `M 0,${height} L ${pts.join(" ")} L ${width},${height} Z`;
  const gId = `sg-${color.replace(/[^a-z0-9]/gi, "")}-${width}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gId})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── LiveStrip ─────────────────────────────────────────────────────────────────

function LiveStrip({ runs }: { runs: PersistedRun[] }) {
  if (runs.length === 0) return null;
  return (
    <section className="act-live-strip">
      <div className="act-strip-head">
        <span className="live-led" />
        Live now
        <span className="count-pill">{runs.length}</span>
        <span className="line" />
        <span style={{ textTransform: "none", letterSpacing: 0 }}>
          updating live
        </span>
      </div>
      {runs.map((r) => (
        <div
          key={r.id}
          className="act-live-run"
          style={{ "--progress": "60%" } as React.CSSProperties}
        >
          <div className="agent-av">{agentInitial(r.agentName)}</div>
          <div className="info">
            <div className="who">
              <span className="led" />
              {r.agentName}
            </div>
            <div className="prompt">{r.prompt}</div>
          </div>
          <span className="phase-pill">
            <Icon name="refresh" size={11} />
            running
          </span>
          <span className="meta-cell">
            <span className="lbl">elapsed </span>
            {elapsedSince(r.ts)}
          </span>
          <span className="meta-cell">
            {fmtTok(r.tokensIn + r.tokensOut)} tok · {formatCost(r.cost)}
          </span>
          <Link href={PAGE_ROUTES.run(r.id)} className="btn sm ghost">
            <Icon name="chevron" size={12} />
          </Link>
        </div>
      ))}
    </section>
  );
}

// ── StatTiles ─────────────────────────────────────────────────────────────────

function StatTiles({ runs }: { runs: PersistedRun[] }) {
  const today = useMemo(() => todayIso(), []);
  const yesterday = useMemo(() => yesterdayIso(), []);

  const todayRuns = useMemo(
    () => runs.filter((r) => isoDay(r.ts) === today),
    [runs, today],
  );
  const yRuns = useMemo(
    () => runs.filter((r) => isoDay(r.ts) === yesterday),
    [runs, yesterday],
  );

  const tCount = todayRuns.length;
  const tCost = todayRuns.reduce((s, r) => s + r.cost, 0);
  const tTokens = todayRuns.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0);
  const tOk = todayRuns.filter((r) => r.status === "done").length;
  const tSuccess = tCount === 0 ? 100 : Math.round((100 * tOk) / tCount);

  const yCount = yRuns.length;
  const yCost = yRuns.reduce((s, r) => s + r.cost, 0);
  const yTokens = yRuns.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0);
  const yOk = yRuns.filter((r) => r.status === "done").length;
  const ySuccess = yCount === 0 ? 100 : Math.round((100 * yOk) / yCount);

  // Build a 14-day sparkline from runs bucketed by day
  const sparkData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86_400_000);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    });
    return (metric: (r: PersistedRun) => number) =>
      days.map((d) =>
        runs.filter((r) => isoDay(r.ts) === d).reduce((s, r) => s + metric(r), 0),
      );
  }, [runs]);

  const countSpark = sparkData(() => 1);
  const tokenSpark = sparkData((r) => r.tokensIn + r.tokensOut);
  const costSpark = sparkData((r) => r.cost);
  const successSpark = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date(Date.now() - (13 - i) * 86_400_000);
        d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        const dayRuns = runs.filter((r) => isoDay(r.ts) === key);
        if (dayRuns.length === 0) return 100;
        return Math.round(
          (100 * dayRuns.filter((r) => r.status === "done").length) /
            dayRuns.length,
        );
      }),
    [runs],
  );

  function delta(
    cur: number,
    ref: number,
  ): { text: string; cls: string } {
    if (ref === 0) return { text: "—", cls: "flat" };
    const pct = Math.round((100 * (cur - ref)) / ref);
    if (pct === 0) return { text: "no change vs yesterday", cls: "flat" };
    return {
      text: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}% vs yesterday`,
      cls: pct > 0 ? "" : "neg",
    };
  }

  const tiles = [
    {
      label: "Runs today",
      value: tCount,
      unit: "runs",
      delta: delta(tCount, yCount),
      spark: countSpark,
      color: "#E95420",
    },
    {
      label: "Tokens used",
      value: fmtTok(tTokens),
      unit: "tok",
      delta: delta(tTokens, yTokens),
      spark: tokenSpark,
      color: "#9C27B0",
    },
    {
      label: "Spend today",
      value: formatCost(tCost),
      unit: "USD",
      delta: delta(tCost, yCost),
      spark: costSpark,
      color: "#22c55e",
    },
    {
      label: "Success rate",
      value: `${tSuccess}%`,
      unit: "",
      delta: delta(tSuccess, ySuccess),
      spark: successSpark,
      color: "#2A6FDB",
    },
  ];

  return (
    <div className="act-stat-grid">
      {tiles.map((t) => (
        <div key={t.label} className="act-stat-tile">
          <div className="lbl">{t.label}</div>
          <div className="val">
            {t.value}
            {t.unit && <span className="unit">{t.unit}</span>}
          </div>
          <div className={`delta ${t.delta.cls}`}>{t.delta.text}</div>
          <div className="spark-wrap">
            <Spark data={t.spark} color={t.color} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function Heatmap({ runs }: { runs: PersistedRun[] }) {
  const grid = useMemo(() => {
    const now = new Date();
    const result: number[][] = [];
    for (let d = 6; d >= 0; d--) {
      const row: number[] = new Array(24).fill(0);
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - d);
      const dayEnd = dayStart.getTime() + 86_400_000;
      for (const r of runs) {
        if (r.ts >= dayStart.getTime() && r.ts < dayEnd) {
          const h = new Date(r.ts).getHours();
          row[h] = (row[h] ?? 0) + 1;
        }
      }
      result.push(row);
    }
    return result;
  }, [runs]);

  const max = Math.max(...grid.flat(), 1);
  const total = grid.flat().reduce((s, v) => s + v, 0);

  const dayLabels = useMemo(() => {
    const now = new Date();
    const days: string[] = [];
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - d);
      days.push(
        (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const)[
          dt.getDay()
        ] ?? "Mon",
      );
    }
    return days;
  }, []);

  const nowDay = 6; // last row is today
  const nowHour = new Date().getHours();

  const busiest = useMemo(() => {
    let best = { d: 0, h: 0, v: 0 };
    grid.forEach((row, d) =>
      row.forEach((v, h) => {
        if (v > best.v) best = { d, h, v };
      }),
    );
    return best;
  }, [grid]);

  function lvl(v: number): string {
    if (v === 0) return "";
    const r = v / max;
    if (r < 0.25) return "l1";
    if (r < 0.5) return "l2";
    if (r < 0.8) return "l3";
    return "l4";
  }

  return (
    <div className="act-heatmap">
      <div className="act-heatmap-head">
        <div>
          <div className="ttl">Activity timeline</div>
          <div className="sub">
            last 7 days · {total} runs · busiest {dayLabels[busiest.d]}{" "}
            {String(busiest.h).padStart(2, "0")}:00
          </div>
        </div>
        <div className="legend">
          less
          <div className="scale">
            <div className="sc" />
            <div className="sc l1" />
            <div className="sc l2" />
            <div className="sc l3" />
            <div className="sc l4" />
          </div>
          more
        </div>
      </div>

      <div className="act-heatmap-grid">
        {grid.map((row, d) => (
          <Fragment key={d}>
            <div className="day-lbl">{dayLabels[d]}</div>
            {row.map((v, h) => (
              <div
                key={h}
                className={`hcell ${lvl(v)} ${d === nowDay && h === nowHour ? "now" : ""}`}
                title={`${dayLabels[d]} ${String(h).padStart(2, "0")}:00 — ${v} run${v === 1 ? "" : "s"}`}
              />
            ))}
          </Fragment>
        ))}
      </div>

      <div className="act-heatmap-foot">
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="h-lbl">
            {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

type Filters = {
  query: string;
  statuses: Array<PersistedRun["status"]>;
};

function FilterBar({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  function toggleStatus(s: PersistedRun["status"]) {
    const has = filters.statuses.includes(s);
    setFilters({
      ...filters,
      statuses: has
        ? filters.statuses.filter((x) => x !== s)
        : [...filters.statuses, s],
    });
  }

  return (
    <div className="act-filter-bar">
      <div className="act-filter-search">
        <Icon name="search" size={14} />
        <input
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          placeholder="Search prompts, run IDs, agents…"
        />
        <kbd>/</kbd>
      </div>

      <button
        className={`act-f-chip ${filters.statuses.includes("done") ? "on" : ""}`}
        onClick={() => toggleStatus("done")}
        type="button"
      >
        <span className="dot" style={{ color: "#22c55e" }} />
        done
      </button>
      <button
        className={`act-f-chip ${filters.statuses.includes("error") ? "on" : ""}`}
        onClick={() => toggleStatus("error")}
        type="button"
      >
        <span className="dot" style={{ color: "#ef4444" }} />
        error
      </button>
      <button
        className={`act-f-chip ${filters.statuses.includes("running") ? "on" : ""}`}
        onClick={() => toggleStatus("running")}
        type="button"
      >
        <span className="dot" style={{ color: "#E95420" }} />
        live
      </button>
    </div>
  );
}

// ── Feed row ──────────────────────────────────────────────────────────────────

function FeedRow({
  run,
  isOpen,
  onToggle,
  maxCost,
}: {
  run: PersistedRun;
  isOpen: boolean;
  onToggle: () => void;
  maxCost: number;
}) {
  const tokens = run.tokensIn + run.tokensOut;
  const dotCls =
    run.status === "error" ? "error" : run.status === "running" ? "running" : "";

  return (
    <>
      <div
        className={`act-row ${isOpen ? "open" : ""}`}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
      >
        <div className="act-row-av">
          {agentInitial(run.agentName)}
          <span className={`sdot ${dotCls}`} />
        </div>

        <div className="act-row-main">
          <div className="act-row-who">
            <span>{run.agentName}</span>
            <span className="model-tag">{run.model || "default"}</span>
          </div>
          <div className="act-row-prompt">{run.prompt}</div>
        </div>

        <div className="act-row-cost">
          <div className="cv">{formatCost(run.cost)}</div>
          <div className="bar">
            <div
              className="fill"
              style={{
                width: `${Math.max(2, (run.cost / Math.max(maxCost, 0.001)) * 100)}%`,
              }}
            />
          </div>
        </div>

        <span className="act-row-cell">{formatDuration(run.durMs)}</span>
        <span className="act-row-cell dim">{fmtTok(tokens)} tok</span>
        <span className="act-row-cell dim">{formatRelative(run.ts)}</span>

        <span className="act-row-chev">
          <Icon name="chevron-down" size={14} />
        </span>

        <div
          className="act-row-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={PAGE_ROUTES.run(run.id)}>
            <button type="button" title="Open run">
              <Icon name="chevron" size={12} />
            </button>
          </Link>
          <button type="button" title="Branch">
            <Icon name="branch" size={12} />
          </button>
          <button type="button" title="Copy prompt">
            <Icon name="copy" size={12} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="act-detail">
          <div className="panel">
            <div className="head">
              <Icon name="chevron" size={10} /> prompt
            </div>
            <div className="body">{run.prompt}</div>
          </div>
          <div className="panel">
            <div className="head">
              <Icon name="activity" size={10} /> response
            </div>
            <div className="body">
              {run.output || "(no output recorded)"}
            </div>
          </div>
          <div className="timeline">
            <div className="step">
              <div className="l">run id</div>
              <div className="v">{run.id.slice(0, 12)}…</div>
            </div>
            <div className="step">
              <div className="l">duration</div>
              <div className="v">{formatDuration(run.durMs)}</div>
            </div>
            <div className="step">
              <div className="l">tokens</div>
              <div className="v">{fmtTok(tokens)}</div>
            </div>
            <div className="step">
              <div className="l">cost</div>
              <div className="v">{formatCost(run.cost)}</div>
            </div>
            <div className="step">
              <div className="l">model</div>
              <div className="v">{run.model || "default"}</div>
            </div>
            <div className="step">
              <div className="l">effort</div>
              <div className="v">{run.effort || "default"}</div>
            </div>
            {run.cwd && (
              <div className="step">
                <div className="l">cwd</div>
                <div className="v">{run.cwd}</div>
              </div>
            )}
          </div>
          <div className="act-btns">
            <Link href={PAGE_ROUTES.run(run.id)} className="btn sm">
              <Icon name="chevron" size={12} />
              Open in chat
            </Link>
            <button type="button" className="btn sm ghost">
              <Icon name="branch" size={12} />
              Branch from here
            </button>
            <button type="button" className="btn sm ghost">
              <Icon name="copy" size={12} />
              Copy prompt
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export type ActivityFeedProps = {
  agentId?: string;
  projectId?: string;
};

export function ActivityFeed({ agentId, projectId }: ActivityFeedProps) {
  const [scope, setScope] = useState<"today" | "week" | "month" | "all">(
    "week",
  );
  const [filters, setFilters] = useState<Filters>({
    query: "",
    statuses: [],
  });
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: allRuns = [], isLoading } = useRuns({
    agentId,
    projectId,
    limit: 500,
  });

  const scopedRuns = useMemo(() => {
    if (scope === "all") return allRuns;
    const cutoff =
      scope === "today"
        ? new Date().setHours(0, 0, 0, 0)
        : scope === "week"
          ? Date.now() - 7 * 86_400_000
          : Date.now() - 30 * 86_400_000;
    return allRuns.filter((r) => r.ts >= cutoff);
  }, [allRuns, scope]);

  const liveRuns = useMemo(
    () => allRuns.filter((r) => r.status === "running"),
    [allRuns],
  );

  const filtered = useMemo(() => {
    return scopedRuns.filter((r) => {
      if (
        filters.statuses.length > 0 &&
        !filters.statuses.includes(r.status)
      )
        return false;
      if (filters.query) {
        const blob = `${r.agentName} ${r.prompt} ${r.id}`.toLowerCase();
        if (!blob.includes(filters.query.toLowerCase())) return false;
      }
      return true;
    });
  }, [scopedRuns, filters]);

  const groups = useMemo(() => groupRunsByDay(filtered), [filtered]);

  const maxCost = useMemo(
    () => Math.max(0.001, ...filtered.map((r) => r.cost)),
    [filtered],
  );

  return (
    <>
      <div className="toolbar">
        <h1>Activity</h1>
        <span className="sub">· run history across all agents</span>
        <div className="right">
          <div className="act-scope-seg">
            {(["today", "week", "month", "all"] as const).map((s) => (
              <button
                key={s}
                className={scope === s ? "on" : ""}
                onClick={() => setScope(s)}
                type="button"
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <button type="button" className="btn sm ghost">
            <Icon name="copy" size={12} />
            Export
          </button>
        </div>
      </div>

      <div className="act-page-body">
        <LiveStrip runs={liveRuns} />
        <StatTiles runs={allRuns} />
        <Heatmap runs={allRuns} />
        <FilterBar filters={filters} setFilters={setFilters} />

        {isLoading ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--txt-3)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
            }}
          >
            loading runs…
          </div>
        ) : groups.length === 0 ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "var(--txt-3)",
              background: "var(--bg-1)",
              border: "1px solid var(--line)",
              borderRadius: 12,
            }}
          >
            <Icon name="search" size={24} />
            <div style={{ marginTop: 10, fontSize: 14, color: "var(--txt-2)" }}>
              Nothing matches your filter.
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
            >
              Try widening the agent or status filter.
            </div>
          </div>
        ) : (
          <div>
            {groups.map((g) => {
              const dayCost = g.runs.reduce((s, r) => s + r.cost, 0);
              const dayTok = g.runs.reduce(
                (s, r) => s + r.tokensIn + r.tokensOut,
                0,
              );
              return (
                <div key={g.day}>
                  <div className="act-day-strip">
                    <span className="day">{dayLabel(g.day)}</span>
                    <span className="runs-pill">{g.runs.length} runs</span>
                    <span className="line" />
                    <span className="stats">
                      {formatCost(dayCost)} · {fmtTok(dayTok)} tok
                    </span>
                  </div>
                  {g.runs.map((r) => (
                    <FeedRow
                      key={r.id}
                      run={r}
                      isOpen={openId === r.id}
                      onToggle={() =>
                        setOpenId(openId === r.id ? null : r.id)
                      }
                      maxCost={maxCost}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
