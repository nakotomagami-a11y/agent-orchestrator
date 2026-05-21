"use client";

import { useState, useMemo, Fragment } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import type { PersistedRun } from "@agent-office/shared/types";
import { useRuns } from "../hooks/use-runs";
import { useOfficeStore } from "@/modules/office/hooks/use-office-store";
import { useBranchStore } from "@/lib/branch-store";
import {
  formatCost,
  formatDuration,
  formatRelative,
  dayLabel,
  groupRunsByDay,
} from "../utils/format-run-meta";
import { cn } from "@/lib/cn";

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
      className="overflow-visible"
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
    <section className="flex flex-col gap-[8px]">
      <div className="flex items-center uppercase text-txt-3 gap-[10px] font-[var(--font-mono)] text-[10.5px] tracking-[0.1em]">
        <span className="live-led shrink-0 relative rounded-full w-[7px] h-[7px]" style={{ background: "var(--working)" }} />
        Live now
        <span className="bg-bg-2 border border-line text-txt-2 rounded-full normal-case px-[8px] py-[1px] tracking-[0]">{runs.length}</span>
        <span className="flex-1 h-[1px] bg-[var(--line)]" />
        <span className="normal-case tracking-normal">
          updating live
        </span>
      </div>
      {runs.map((r) => (
        <div
          key={r.id}
          className="act-live-run"
          style={{ gridTemplateColumns: "30px minmax(0,1fr) auto auto auto auto" }}
        >
          <div className="grid place-items-center shrink-0 bg-bg-3 border border-line uppercase font-bold text-txt-2 w-[28px] h-[28px] rounded-[6px] text-[14px] font-[var(--font-mono)]">{agentInitial(r.agentName)}</div>
          <div className="min-w-0">
            <div className="flex items-center font-semibold text-txt gap-[8px] text-[13px]">
              <span className="rounded-full w-[6px] h-[6px]" style={{ background: "var(--working)", boxShadow: "0 0 6px var(--working)", animation: "pulseDot 1s infinite" }} />
              {r.agentName}
            </div>
            <div className="text-txt-3 whitespace-nowrap overflow-hidden text-ellipsis font-[var(--font-mono)] text-[11.5px] mt-[2px]">{r.prompt}</div>
          </div>
          <span className="inline-flex items-center bg-bg-2 border border-line rounded-full text-txt-2 whitespace-nowrap gap-[6px] px-[10px] py-[4px] font-[var(--font-mono)] text-[11px]">
            <Icon name="refresh" size={11} />
            running
          </span>
          <span className="text-txt-2 whitespace-nowrap font-[var(--font-mono)] text-[11px]">
            <span className="text-txt-4">elapsed </span>
            {elapsedSince(r.ts)}
          </span>
          <span className="text-txt-2 whitespace-nowrap font-[var(--font-mono)] text-[11px]">
            {fmtTok(r.tokensIn + r.tokensOut)} tok · {formatCost(r.cost)}
          </span>
          <Button href={PAGE_ROUTES.run(r.id)} variant="ghost" size="sm">
            <Icon name="chevron" size={12} />
          </Button>
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
    if (ref === 0) return { text: "-", cls: "flat" };
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
    <div className="grid [grid-template-columns:repeat(4,1fr)] max-[1024px]:[grid-template-columns:repeat(2,1fr)] max-[600px]:[grid-template-columns:1fr] gap-[12px]">
      {tiles.map((t) => (
        <div key={t.label} className="bg-bg-1 border border-line relative overflow-hidden flex flex-col px-[16px] py-[14px] rounded-[12px] gap-[5px] min-h-[106px] [box-shadow:var(--shadow-1)]">
          <div className="text-txt-3 uppercase font-[var(--font-mono)] text-[10px] tracking-[0.1em]">{t.label}</div>
          <div className="font-bold text-txt text-[24px] tracking-[-0.01em]">
            {t.value}
            {t.unit && <span className="text-txt-3 font-medium text-[12px] ml-[3px] font-[var(--font-mono)]">{t.unit}</span>}
          </div>
          <div className={cn("inline-flex items-center gap-[4px] font-[var(--font-mono)] text-[10.5px]", t.delta.cls === "neg" ? "text-[var(--error)]" : t.delta.cls === "flat" ? "text-txt-3" : "text-[var(--working)]")}>
            {t.delta.text}
          </div>
          <div className="absolute right-[12px] bottom-[12px] w-[70px] h-[34px]">
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
    <div className="bg-bg-1 border border-line rounded-[12px] px-[18px] py-[16px] [box-shadow:var(--shadow-1)]">
      <div className="flex items-center gap-[10px] mb-[14px]">
        <div>
          <div className="font-semibold text-txt text-[13px]">Activity timeline</div>
          <div className="text-txt-3 text-[11px] font-[var(--font-mono)]">
            last 7 days · {total} runs · busiest {dayLabels[busiest.d]}{" "}
            {String(busiest.h).padStart(2, "0")}:00
          </div>
        </div>
        <div className="ml-auto flex items-center text-txt-3 gap-[6px] font-[var(--font-mono)] text-[10px]">
          less
          <div className="flex gap-[2px]">
            <div className="bg-bg-3 border border-line w-[10px] h-[10px] rounded-[2px]" />
            <div className="hcell l1 w-[10px] h-[10px] rounded-[2px]" />
            <div className="hcell l2 w-[10px] h-[10px] rounded-[2px]" />
            <div className="hcell l3 w-[10px] h-[10px] rounded-[2px]" />
            <div className="hcell l4 w-[10px] h-[10px] rounded-[2px]" />
          </div>
          more
        </div>
      </div>

      <div className="act-heatmap-scroll overflow-x-auto">
        <div className="act-heatmap-grid grid items-center gap-[2px]" style={{ gridTemplateColumns: "26px repeat(24, 1fr)" }}>
          {grid.map((row, d) => (
            <Fragment key={d}>
              <div className="text-txt-3 text-right font-[var(--font-mono)] text-[9.5px] pr-[4px]">{dayLabels[d]}</div>
              {row.map((v, h) => (
                <div
                  key={h}
                  className={`hcell bg-bg-3 border border-line cursor-pointer relative h-[16px] rounded-[2px] transition-transform duration-[100ms] ${lvl(v)} ${d === nowDay && h === nowHour ? "now" : ""}`}
                  title={`${dayLabels[d]} ${String(h).padStart(2, "0")}:00 - ${v} run${v === 1 ? "" : "s"}`}
                />
              ))}
            </Fragment>
          ))}
        </div>

        <div className="act-heatmap-foot grid gap-[2px] mt-[4px]" style={{ gridTemplateColumns: "26px repeat(24, 1fr)" }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-txt-4 text-center font-[var(--font-mono)] text-[9px]">
              {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
            </div>
          ))}
        </div>
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
    <div className="flex items-center flex-wrap gap-[8px]">
      <div className="act-filter-search flex-1 flex items-center bg-bg-1 border border-line-2 text-txt-3 min-w-[220px] gap-[10px] px-[13px] py-[8px] rounded-[10px] [box-shadow:var(--shadow-1)]">
        <Icon name="search" size={14} />
        <input
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          placeholder="Search prompts, run IDs, agents…"
          className="flex-1 bg-transparent border-none text-txt outline-none text-[13.5px] [&::placeholder]:text-txt-4"
        />
        <kbd className="bg-bg-2 border border-line text-txt-3 font-[var(--font-mono)] text-[10px] px-[5px] py-[1px] rounded-[4px]">/</kbd>
      </div>

      <button
        className={cn("act-f-chip inline-flex items-center bg-bg-1 border border-line-2 text-txt-2 cursor-pointer gap-[6px] px-[11px] py-[7px] rounded-[8px] text-[12.5px] [box-shadow:var(--shadow-1)]", filters.statuses.includes("done") && "on")}
        onClick={() => toggleStatus("done")}
        type="button"
      >
        <span className="dot rounded-full w-[6px] h-[6px] bg-current text-[#22c55e]" />
        done
      </button>
      <button
        className={cn("act-f-chip inline-flex items-center bg-bg-1 border border-line-2 text-txt-2 cursor-pointer gap-[6px] px-[11px] py-[7px] rounded-[8px] text-[12.5px] [box-shadow:var(--shadow-1)]", filters.statuses.includes("error") && "on")}
        onClick={() => toggleStatus("error")}
        type="button"
      >
        <span className="dot rounded-full w-[6px] h-[6px] bg-current text-[#ef4444]" />
        error
      </button>
      <button
        className={cn("act-f-chip inline-flex items-center bg-bg-1 border border-line-2 text-txt-2 cursor-pointer gap-[6px] px-[11px] py-[7px] rounded-[8px] text-[12.5px] [box-shadow:var(--shadow-1)]", filters.statuses.includes("running") && "on")}
        onClick={() => toggleStatus("running")}
        type="button"
      >
        <span className="dot rounded-full w-[6px] h-[6px] bg-current text-[#E95420]" />
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
  const selectAgent = useOfficeStore((s) => s.select);
  const setBranchSeed = useBranchStore((s) => s.setSeed);

  const handleBranch = () => {
    setBranchSeed({ agentId: run.agentId, instanceId: run.instanceId ?? null, prompt: run.prompt });
    selectAgent(run.agentId, { tab: "conversation", instanceId: run.instanceId ?? null });
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(run.prompt);
  };

  const tokens = run.tokensIn + run.tokensOut;
  const dotCls =
    run.status === "error" ? "error" : run.status === "running" ? "running" : "";

  return (
    <>
      <div
        className={cn("act-row grid items-center bg-bg-1 border border-line cursor-pointer relative gap-[12px] px-[14px] py-[11px] rounded-[10px] mb-[5px] transition-[background,border-color] duration-[100ms] [box-shadow:var(--shadow-1)]", isOpen && "open")}
        style={{ gridTemplateColumns: "28px minmax(0,1fr) 100px auto auto auto 18px" }}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
      >
        <div className="act-row-av grid place-items-center bg-bg-2 border border-line font-bold text-txt-2 uppercase relative shrink-0 w-[26px] h-[26px] rounded-[6px] text-[13px] font-[var(--font-mono)]">
          {agentInitial(run.agentName)}
          <span className={cn("sdot absolute rounded-full bottom-[-2px] right-[-2px] w-[8px] h-[8px] [border:2px_solid_var(--bg-1)]", dotCls === "error" ? "[background:var(--error)]" : "[background:var(--working)]", dotCls)} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center font-semibold text-txt gap-[7px] text-[13px]">
            <span>{run.agentName}</span>
            <span className="text-txt-3 bg-bg-2 border border-line font-normal font-[var(--font-mono)] text-[10px] rounded-[4px] px-[5px] py-[1px]">{run.model || "default"}</span>
          </div>
          <div className="text-txt-3 whitespace-nowrap overflow-hidden text-ellipsis font-[var(--font-mono)] text-[11.5px] mt-[2px]">{run.prompt}</div>
        </div>

        <div className="flex flex-col gap-[3px] font-[var(--font-mono)] text-[11px]">
          <div className="text-txt">{formatCost(run.cost)}</div>
          <div className="overflow-hidden bg-bg-3 h-[3px] rounded-[2px]">
            <div
              className="act-row-cost-fill h-full rounded-[2px]"
              style={{
                width: `${Math.max(2, (run.cost / Math.max(maxCost, 0.001)) * 100)}%`,
              }}
            />
          </div>
        </div>

        <span className="text-txt-2 whitespace-nowrap font-[var(--font-mono)] text-[11.5px]">{formatDuration(run.durMs)}</span>
        <span className="text-txt-3 whitespace-nowrap font-[var(--font-mono)] text-[11.5px]">{fmtTok(tokens)} tok</span>
        <span className="text-txt-3 whitespace-nowrap font-[var(--font-mono)] text-[11.5px]">{formatRelative(run.ts)}</span>

        <span className={cn("act-row-chev text-txt-4 transition-transform duration-[180ms]", isOpen && "text-acc rotate-180")}>
          <Icon name="chevron-down" size={14} />
        </span>

        <div
          className="act-row-actions absolute flex bg-bg-1 border border-line opacity-0 gap-[2px] p-[2px] rounded-[8px] transition-[opacity] duration-[140ms]"
          style={{ right: 34, top: "50%", transform: "translateY(-50%)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={PAGE_ROUTES.run(run.id)}>
            <button type="button" title="Open run" className="grid place-items-center text-txt-3 w-[24px] h-[24px] rounded-[5px] hover:bg-bg-2 hover:text-txt">
              <Icon name="chevron" size={12} />
            </button>
          </Link>
          <button type="button" title="Branch from here" className="grid place-items-center text-txt-3 w-[24px] h-[24px] rounded-[5px] hover:bg-bg-2 hover:text-txt" onClick={handleBranch}>
            <Icon name="branch" size={12} />
          </button>
          <button type="button" title="Copy prompt" className="grid place-items-center text-txt-3 w-[24px] h-[24px] rounded-[5px] hover:bg-bg-2 hover:text-txt" onClick={handleCopyPrompt}>
            <Icon name="copy" size={12} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="act-detail grid bg-bg-2 m-0 mb-[5px] border-t-0 rounded-b-[10px] px-[16px] py-[14px] gap-[12px]" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="bg-bg-1 border border-line overflow-hidden rounded-[8px]">
            <div className="flex items-center text-txt-3 uppercase border-b border-line px-[12px] py-[7px] font-[var(--font-mono)] text-[10px] tracking-[0.08em] gap-[8px]">
              <Icon name="chevron" size={10} /> prompt
            </div>
            <div className="text-txt overflow-y-auto break-words px-[12px] py-[10px] font-[var(--font-mono)] text-[11.5px] leading-[1.55] max-h-[150px] whitespace-pre-wrap">{run.prompt}</div>
          </div>
          <div className="bg-bg-1 border border-line overflow-hidden rounded-[8px]">
            <div className="flex items-center text-txt-3 uppercase border-b border-line px-[12px] py-[7px] font-[var(--font-mono)] text-[10px] tracking-[0.08em] gap-[8px]">
              <Icon name="activity" size={10} /> response
            </div>
            <div className="text-txt overflow-y-auto break-words px-[12px] py-[10px] font-[var(--font-mono)] text-[11.5px] leading-[1.55] max-h-[150px] whitespace-pre-wrap">
              {run.output || "(no output recorded)"}
            </div>
          </div>
          <div className="flex flex-wrap gap-[18px] pt-[8px] border-t border-dashed border-line" style={{ gridColumn: "1 / -1" }}>
            {[
              { l: "run id", v: run.id.slice(0, 12) + "…" },
              { l: "duration", v: formatDuration(run.durMs) },
              { l: "tokens", v: fmtTok(tokens) },
              { l: "cost", v: formatCost(run.cost) },
              { l: "model", v: run.model || "default" },
              { l: "effort", v: run.effort || "default" },
              ...(run.cwd ? [{ l: "cwd", v: run.cwd }] : []),
            ].map(({ l, v }) => (
              <div key={l} className="flex flex-col font-[var(--font-mono)]">
                <div className="text-txt-4 uppercase text-[9.5px] tracking-[0.08em]">{l}</div>
                <div className="text-txt text-[11.5px] mt-[2px]">{v}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-[8px] pt-[10px] border-t border-dashed border-line" style={{ gridColumn: "1 / -1" }}>
            <Button href={PAGE_ROUTES.run(run.id)} size="sm">
              <Icon name="chevron" size={12} />
              Open in chat
            </Button>
            <Button size="sm" variant="ghost" onClick={handleBranch}>
              <Icon name="branch" size={12} />
              Branch from here
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCopyPrompt}>
              <Icon name="copy" size={12} />
              Copy prompt
            </Button>
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

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const maxCost = useMemo(
    () => Math.max(0.001, ...filtered.map((r) => r.cost)),
    [filtered],
  );

  return (
    <>
      <div className="flex items-center gap-[10px] px-[18px] py-[10px] border-b border-line bg-bg-1">
        <h1 className="m-0 text-[16px] font-bold tracking-[-0.01em]">Activity</h1>
        <span className="text-[12px] text-txt-3 font-[var(--font-mono)]">
          {projectId ? "· run history for this project" : "· run history across all agents"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="act-scope-seg flex bg-bg-2 border border-line p-[3px] max-[600px]:hidden" style={{ borderRadius: "var(--r-md)" }}>
            {(["today", "week", "month", "all"] as const).map((s) => (
              <button
                key={s}
                className={cn("bg-transparent border-none cursor-pointer text-txt-3 px-[11px] py-[4px] rounded-[6px] text-[12px] font-[var(--font-mono)]", scope === s && "on")}
                onClick={() => setScope(s)}
                type="button"
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={handleExport} disabled={filtered.length === 0}>
            <Icon name="copy" size={12} />
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-col overflow-y-auto flex-1 min-h-0 px-[24px] pt-[20px] pb-[32px] gap-[20px]">
        <LiveStrip runs={liveRuns} />
        <StatTiles runs={allRuns} />
        <Heatmap runs={allRuns} />
        <FilterBar filters={filters} setFilters={setFilters} />

        {isLoading ? (
          <div className="p-8 text-center text-txt-3 font-mono text-[13px]">
            loading runs…
          </div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-txt-3 bg-bg-1 border border-line rounded-xl">
            <Icon name="search" size={24} />
            <div className="mt-2.5 text-[14px] text-txt-2">
              Nothing matches your filter.
            </div>
            <div className="mt-1 text-[12px] font-mono">
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
                  <div className="flex items-center text-txt-3 gap-[12px] px-[2px] pt-[12px] pb-[8px] font-[var(--font-mono)] text-[11px]">
                    <span className="uppercase text-txt-2 font-semibold tracking-[0.08em]">{dayLabel(g.day)}</span>
                    <span className="bg-bg-2 border border-line text-txt-2 rounded-full px-[8px] py-[1px]">{g.runs.length} runs</span>
                    <span className="flex-1 h-[1px] bg-[var(--line)]" />
                    <span className="text-txt-3 whitespace-nowrap">
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
