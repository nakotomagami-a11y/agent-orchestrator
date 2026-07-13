"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ModalShell } from "@/components/ui/modal-shell";
import { getDbStats, runSeed, type DbStats, type SeedAction } from "@/lib/api/dev-seed";

type BtnState = "idle" | "loading" | "done" | "error";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="w-[3px] h-[13px] bg-acc rounded-full shrink-0" />
      <span className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider">{children}</span>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  variant = "default",
  state,
  message,
}: {
  label: string;
  action?: SeedAction; // used only for key/identity at call site
  onClick: () => void;
  variant?: "default" | "accent" | "danger";
  state: BtnState;
  message?: string;
}) {
  const base = "w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-mono transition-colors border";
  const variants = {
    default: "bg-bg-2 text-txt-2 hover:text-txt hover:bg-bg-3 border-line hover:border-line-2",
    accent:  "bg-acc text-white hover:opacity-90 border-acc",
    danger:  "bg-transparent text-red-400 hover:text-red-300 hover:bg-red-900/20 border-red-900/40 hover:border-red-900/60",
  };
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={onClick}
        disabled={state === "loading"}
        className={`${base} ${variants[variant]} ${state === "loading" ? "opacity-50 cursor-wait" : ""}`}
      >
        {state === "loading" ? "working…" : state === "done" ? "✓ done" : label}
      </button>
      {message && <p className="text-[10.5px] text-txt-4 font-mono text-center px-1">{message}</p>}
    </div>
  );
}

export function DevMenu() {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [states, setStates] = useState<Record<SeedAction, BtnState>>({
    office: "idle", memory: "idle", all: "idle", clear: "idle",
    "clear-all-runs": "idle", "fix-orphans": "idle",
  });
  const [messages, setMessages] = useState<Partial<Record<SeedAction, string>>>({});
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const loadStats = useCallback(async () => {
    try { setStats(await getDbStats()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (open) void loadStats();
  }, [open, loadStats]);

  async function handleAction(action: SeedAction) {
    setStates(s => ({ ...s, [action]: "loading" }));
    setMessages(m => ({ ...m, [action]: undefined }));
    try {
      const msg = await runSeed(action);
      setStates(s => ({ ...s, [action]: "done" }));
      setMessages(m => ({ ...m, [action]: msg }));
      await queryClient.invalidateQueries();
      await loadStats();
      setTimeout(() => setStates(s => ({ ...s, [action]: "idle" })), 3000);
    } catch (e) {
      setStates(s => ({ ...s, [action]: "idle" }));
      setMessages(m => ({ ...m, [action]: e instanceof Error ? e.message : "error" }));
    }
  }

  async function copyDbPath() {
    if (!stats?.dbPath) return;
    await navigator.clipboard.writeText(stats.dbPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-[24px] px-[10px] inline-flex items-center gap-[6px] bg-transparent border border-transparent rounded-sm text-txt-2 font-[inherit] text-[12.5px] cursor-pointer hover:bg-bg-2 hover:border-line"
      >
        <FlaskIcon />
        Dev
      </button>

      <ModalShell open={open} onClose={() => setOpen(false)} title="Dev Tools" size="sm" maxWidth={400}>
        <div className="flex flex-col gap-5">

          {/* ── Demo data ── */}
          <div>
            <SectionLabel>Demo data</SectionLabel>
            <div className="flex flex-col gap-1.5">
              <ActionBtn label="Seed office floor + runs" action="office" state={states.office} message={messages.office} onClick={() => handleAction("office")} />
              <ActionBtn label="Seed agent memories" action="memory" state={states.memory} message={messages.memory} onClick={() => handleAction("memory")} />
              <ActionBtn label="Seed everything" action="all" variant="accent" state={states.all} message={messages.all} onClick={() => handleAction("all")} />
              <ActionBtn label="Clear demo data" action="clear" variant="danger" state={states.clear} message={messages.clear} onClick={() => handleAction("clear")} />
            </div>
          </div>

          {/* ── Database ── */}
          <div>
            <SectionLabel>Database</SectionLabel>

            {stats ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 bg-bg-2 rounded-lg px-3 py-2.5 border border-line [&>*]:basis-[calc(50%-8px)]">
                <StatRow label="Runs" value={stats.runsCount.toLocaleString()} />
                <StatRow label="Messages" value={stats.messagesCount.toLocaleString()} />
                <StatRow label="Agents" value={stats.agentsCount.toLocaleString()} />
                <StatRow label="DB size" value={fmtBytes(stats.dbSizeBytes)} />
                {stats.orphansCount > 0 && (
                  <div className="col-span-2 mt-1 text-[10.5px] font-mono text-yellow-400">
                    ⚠ {stats.orphansCount} orphaned running run{stats.orphansCount !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[62px] bg-bg-2 rounded-lg border border-line mb-3 flex items-center justify-center text-txt-4 text-[11px] font-mono">loading…</div>
            )}

            <div className="flex flex-col gap-1.5">
              <ActionBtn
                label={`Fix orphans${stats?.orphansCount ? ` (${stats.orphansCount})` : ""}`}
                action="fix-orphans"
                state={states["fix-orphans"]}
                message={messages["fix-orphans"]}
                onClick={() => handleAction("fix-orphans")}
              />
              <ActionBtn
                label="Clear ALL runs & messages"
                action="clear-all-runs"
                variant="danger"
                state={states["clear-all-runs"]}
                message={messages["clear-all-runs"]}
                onClick={() => handleAction("clear-all-runs")}
              />
              <button
                type="button"
                onClick={copyDbPath}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-mono bg-bg-2 border border-line hover:border-line-2 text-txt-3 hover:text-txt transition-colors"
              >
                <span className="shrink-0">{copied ? "✓ copied" : "copy db path"}</span>
                <span className="truncate text-txt-4 text-[10px]">{stats?.dbPath ?? "…"}</span>
              </button>
            </div>
          </div>

          {/* ── Utilities ── */}
          <div>
            <SectionLabel>Utilities</SectionLabel>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-mono bg-bg-2 border border-line hover:border-line-2 text-txt-2 hover:text-txt transition-colors"
            >
              Reload window
            </button>
          </div>

        </div>
      </ModalShell>
    </>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-[10.5px] font-mono text-txt-4">{label}</span>
      <span className="text-[10.5px] font-mono text-txt-2 text-right">{value}</span>
    </>
  );
}

function FlaskIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M9 3v7L5 20h14L15 10V3M9 3h6" />
    </svg>
  );
}
