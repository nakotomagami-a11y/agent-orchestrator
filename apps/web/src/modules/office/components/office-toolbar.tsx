"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useActiveProjectStore } from "@/lib/active-project-store";
import { useProject } from "@/modules/projects/hooks/use-projects";
import { AddAgentModal } from "@/modules/projects/components/add-agent-modal";
import type { OfficeView } from "../hooks/use-office-store";
import type { DetectedCommand } from "@/app/api/projects/[id]/dev/route";
import type { ProcessInfo } from "@/app/api/processes/route";

type InstallState = "unknown" | "needed" | "installing" | "done";

type RunState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "running"; pid: number; port: number | null; url: string | null }
  | { phase: "stopping" };

export function DevServerButton({ projectId }: { projectId: string }) {
  const [commands, setCommands] = useState<DetectedCommand[]>([]);
  const [states, setStates] = useState<Record<string, RunState>>({});
  const [install, setInstall] = useState<InstallState>("unknown");
  const [hasPackageJson, setHasPackageJson] = useState(false);
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  // Tracks whether we've already reconciled running processes for this mount
  const reconciledRef = useRef(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/dev`)
      .then((r) => r.json() as Promise<{ hasPackageJson: boolean; hasNodeModules: boolean; commands: DetectedCommand[] }>)
      .then(({ hasPackageJson: hasPkg, hasNodeModules, commands: cmds }) => {
        setHasPackageJson(hasPkg);
        // Only offer "Install" when there's actually a package.json to install from
        setInstall(hasNodeModules ? "done" : hasPkg ? "needed" : "done");
        setCommands(cmds ?? []);
      })
      .catch(() => setInstall("done"));
  }, [projectId]);

  // Reconcile UI state with already-running processes (survives page refresh)
  useEffect(() => {
    if (commands.length === 0 || reconciledRef.current) return;
    reconciledRef.current = true;
    fetch("/api/processes")
      .then((r) => r.json() as Promise<ProcessInfo[]>)
      .then((processes) => {
        const mine = processes.filter((p) => p.projectId === projectId);
        if (mine.length === 0) return;
        setStates((prev) => {
          const next = { ...prev };
          for (const proc of mine) {
            // Skip processes we're already tracking
            const alreadyTracked = Object.values(next).some(
              (s) => s.phase === "running" && s.pid === proc.pid
            );
            if (alreadyTracked) continue;
            // Match the running process to the closest command by script name
            const matched =
              commands.find((cmd) => {
                const scriptName = cmd.argv[cmd.argv.length - 1] ?? "";
                return proc.cmd.includes(scriptName) || proc.cmd.includes(cmd.key);
              }) ?? commands[0]!;
            if (matched && (!next[matched.key] || next[matched.key]?.phase === "idle")) {
              next[matched.key] = {
                phase: "running",
                pid: proc.pid,
                port: proc.port,
                url: `http://localhost:${proc.port}`,
              };
            }
          }
          return next;
        });
      })
      .catch(() => {});
  }, [commands, projectId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function getState(key: string): RunState {
    return states[key] ?? { phase: "idle" };
  }

  function setKeyState(key: string, s: RunState) {
    setStates((prev) => ({ ...prev, [key]: s }));
  }

  async function runInstall() {
    setInstall("installing");
    try {
      const res = await fetch(`/api/projects/${projectId}/install`, { method: "POST" });
      if (res.ok) {
        setInstall("done");
        // Re-fetch commands now that node_modules exist
        const r2 = await fetch(`/api/projects/${projectId}/dev`);
        const data = await r2.json() as { hasNodeModules: boolean; commands: DetectedCommand[] };
        setCommands(data.commands ?? []);
      } else {
        setInstall("needed");
      }
    } catch {
      setInstall("needed");
    }
  }

  async function startCmd(key: string) {
    setKeyState(key, { phase: "starting" });
    try {
      const res = await fetch(`/api/projects/${projectId}/dev`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandKey: key }),
      });
      const body = await res.json() as { port?: number; url?: string; pid?: number };
      if (!res.ok) { setKeyState(key, { phase: "idle" }); return; }
      setKeyState(key, { phase: "running", pid: body.pid ?? 0, port: body.port ?? null, url: body.url ?? null });
    } catch {
      setKeyState(key, { phase: "idle" });
    }
  }

  async function stopCmd(key: string) {
    const s = getState(key);
    if (s.phase !== "running") return;
    setKeyState(key, { phase: "stopping" });
    try { await fetch(`/api/processes/${s.pid}`, { method: "DELETE" }); } catch { /* best-effort */ }
    setKeyState(key, { phase: "idle" });
  }

  const runningCount = Object.values(states).filter((s) => s.phase === "running").length;
  const busyInstall = install === "needed" || install === "installing";

  // No package.json and no detected commands (e.g. non-JS project) — hide entirely
  if (install !== "unknown" && install !== "installing" && !hasPackageJson && commands.length === 0) {
    return null;
  }

  // ── Install button ──────────────────────────────────────────────────────────
  const installBtn = install === "needed" ? (
    <Button variant="ghost" size="sm" onClick={() => { void runInstall(); }}>
      <Icon name="download" size={12} /> Install
    </Button>
  ) : install === "installing" ? (
    <Button variant="ghost" size="sm" disabled>
      <Icon name="refresh" size={12} className="[animation:spin_1s_linear_infinite]" /> Installing…
    </Button>
  ) : null;

  // ── Single command: inline buttons ─────────────────────────────────────────
  if (commands.length === 1) {
    const cmd = commands[0]!;
    const s = getState(cmd.key);
    return (
      <>
        <span className="inline-flex items-center gap-1.5">
          {installBtn}
          {s.phase === "idle" && (
            <Button variant="ghost" size="sm" onClick={() => { void startCmd(cmd.key); }} disabled={busyInstall}>
              <Icon name="play" size={12} /> Dev server
            </Button>
          )}
          {s.phase === "starting" && (
            <Button variant="ghost" size="sm" disabled>
              <Icon name="refresh" size={12} className="[animation:spin_1s_linear_infinite]" /> Starting…
            </Button>
          )}
          {s.phase === "stopping" && (
            <Button variant="ghost" size="sm" disabled>
              <Icon name="refresh" size={12} className="[animation:spin_1s_linear_infinite]" /> Stopping…
            </Button>
          )}
          {s.phase === "running" && (
            <>
              {s.port !== null && (
                <a
                  href={s.url ?? "#"} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-[11px] text-[var(--txt-2)] no-underline px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--working)_15%,transparent)] border border-[color-mix(in_srgb,var(--working)_30%,transparent)]"
                  title={`Open ${s.url}`}
                >
                  :{s.port}
                </a>
              )}
              <Button variant="ghost" size="sm" onClick={() => { void stopCmd(cmd.key); }} title="Stop dev server">
                <Icon name="stop" size={12} /> Stop
              </Button>
            </>
          )}
        </span>
      </>
    );
  }

  // ── Multiple commands: dropdown ─────────────────────────────────────────────
  if (commands.length > 1) {
    return (
      <>
        <span className="inline-flex items-center gap-1.5">
          {installBtn}
          <div ref={dropRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-[6px] text-txt-2 px-[10px] py-[5px] rounded-[7px] text-[12.5px] border border-transparent transition-[background,color,border-color] duration-[120ms] hover:bg-bg-3 hover:text-txt",
                open && "bg-bg-3 text-txt",
                runningCount > 0 && "text-[var(--working)]",
              )}
              disabled={busyInstall}
            >
              <Icon name="play" size={12} />
              {runningCount > 0 ? `${runningCount} running` : "Dev servers"}
              <Icon name="chevron-down" size={10} />
            </button>

            {open && (
              <div className="absolute top-[calc(100%+6px)] right-0 w-[220px] bg-[var(--bg-elev)] border border-[var(--line-2)] rounded-[10px] shadow-[var(--shadow-3)] z-50 py-1 overflow-hidden">
                {commands.map((cmd) => {
                  const s = getState(cmd.key);
                  const busy = s.phase === "starting" || s.phase === "stopping";
                  return (
                    <div key={cmd.key} className="flex items-center gap-2 px-3 py-[7px] hover:bg-[var(--bg-3)] group">
                      <span className={cn("flex-1 text-[13px] truncate", s.phase === "running" ? "text-[var(--txt)]" : "text-[var(--txt-2)]")}>
                        {cmd.name}
                      </span>
                      {s.phase === "running" && s.port !== null && (
                        <a
                          href={s.url ?? "#"} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[11px] text-[var(--working)] no-underline px-1 py-0.5 rounded bg-[color-mix(in_srgb,var(--working)_12%,transparent)] border border-[color-mix(in_srgb,var(--working)_25%,transparent)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          :{s.port}
                        </a>
                      )}
                      {busy && (
                        <Icon name="refresh" size={13} className="text-[var(--txt-3)] [animation:spin_1s_linear_infinite] shrink-0" />
                      )}
                      {!busy && s.phase === "idle" && (
                        <button
                          type="button"
                          onClick={() => { void startCmd(cmd.key); }}
                          className="w-6 h-6 grid place-items-center rounded-[5px] text-[var(--txt-3)] hover:text-[var(--txt)] hover:bg-[var(--bg-4)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title={`Start ${cmd.name}`}
                        >
                          <Icon name="play" size={11} />
                        </button>
                      )}
                      {!busy && s.phase === "running" && (
                        <button
                          type="button"
                          onClick={() => { void stopCmd(cmd.key); }}
                          className="w-6 h-6 grid place-items-center rounded-[5px] text-[var(--txt-3)] hover:text-[var(--txt)] hover:bg-[var(--bg-4)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title={`Stop ${cmd.name}`}
                        >
                          <Icon name="stop" size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </span>
      </>
    );
  }

  // ── No commands detected ────────────────────────────────────────────────────
  return installBtn;
}

export function OpenFolderButton({ projectId }: { projectId: string }) {
  function open() {
    void fetch(`/api/projects/${projectId}/open-folder`, { method: "POST" });
  }
  return (
    <Button variant="ghost" size="sm" onClick={open} title="Open project folder">
      <Icon name="folder" size={12} /> Open folder
    </Button>
  );
}

type BuildPhase = "idle" | "building" | "done" | "error";

export function BuildButton({ projectId }: { projectId: string }) {
  const [hasBuild, setHasBuild] = useState(false);
  const [phase, setPhase] = useState<BuildPhase>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/build`)
      .then((r) => r.json() as Promise<{ hasBuild: boolean }>)
      .then((d) => setHasBuild(d.hasBuild))
      .catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [projectId]);

  async function startBuild() {
    if (phase !== "idle") return;
    setPhase("building");
    try {
      const res = await fetch(`/api/projects/${projectId}/build`, { method: "POST" });
      if (!res.ok) { setPhase("error"); setTimeout(() => setPhase("idle"), 3000); return; }
      const body = await res.json() as { pid?: number | null };
      if (!body.pid) { setPhase("done"); setTimeout(() => setPhase("idle"), 2000); return; }

      const pid = body.pid;
      pollRef.current = setInterval(async () => {
        const check = await fetch(`/api/processes/${pid}`).catch(() => null);
        if (!check?.ok) return;
        const data = await check.json() as { alive?: boolean };
        if (!data.alive) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setPhase("done");
          setTimeout(() => setPhase("idle"), 3000);
        }
      }, 2000);
    } catch {
      setPhase("error");
      setTimeout(() => setPhase("idle"), 3000);
    }
  }

  if (!hasBuild) return null;

  if (phase === "building") {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Icon name="refresh" size={12} className="[animation:spin_1s_linear_infinite]" /> Building…
      </Button>
    );
  }
  if (phase === "done") {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Icon name="check" size={12} /> Built
      </Button>
    );
  }
  if (phase === "error") {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Icon name="x" size={12} /> Build failed
      </Button>
    );
  }
  return (
    <Button variant="ghost" size="sm" onClick={() => { void startBuild(); }}>
      <Icon name="zap" size={12} /> Build
    </Button>
  );
}

export type OfficeToolbarProps = {
  view: OfficeView;
  setView: (next: OfficeView) => void;
  agentCount: number;
  workingCount: number;
};

export function OfficeToolbar({ view, setView, agentCount, workingCount }: OfficeToolbarProps) {
  const activeProjectId = useActiveProjectStore((s) => s.id);
  const setActiveId = useActiveProjectStore((s) => s.setId);
  const projectQ = useProject(activeProjectId);
  const project = projectQ.data;

  const [addOpen, setAddOpen] = useState(false);

  const rosterCount = activeProjectId ? project?.meta.roster.length ?? 0 : 0;

  return (
    <header className="border-b border-line shrink-0 flex items-center gap-[16px] px-[28px] pt-[18px] pb-[14px]">
      <div className="flex flex-col gap-[2px]">
        <h1 className="font-bold flex items-baseline gap-[10px] m-0 text-[22px] tracking-[-0.01em]">
          The office
          <span className="text-txt-3 font-normal font-[var(--font-mono)] text-[12.5px] tracking-normal">
            {activeProjectId ? (
              <>
                · <span className="text-txt-2">{rosterCount} agent{rosterCount === 1 ? "" : "s"}</span>
                {project ? <> in {project.meta.name}</> : null}
                {" · "}
                <span className="text-txt-2" style={workingCount > 0 ? { color: "var(--working)" } : undefined}>
                  {workingCount} working
                </span>
              </>
            ) : (
              <> · {agentCount} agent{agentCount === 1 ? "" : "s"}</>
            )}
          </span>
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-[8px]">
        {activeProjectId && project?.meta.cwd && (
          <>
            <OpenFolderButton projectId={activeProjectId} />
            <BuildButton key={`build-${activeProjectId}`} projectId={activeProjectId} />
            <DevServerButton key={activeProjectId} projectId={activeProjectId} />
          </>
        )}
        <div className="inline-flex bg-bg-2 border border-line p-[3px] rounded-[8px]">
          <button
            type="button"
            className={cn("inline-flex items-center gap-[6px] text-txt-3 px-[12px] py-[6px] rounded-[5px] text-[12.5px] transition-[background,color] duration-[120ms]", view === "iso" && "bg-bg-3 text-txt [box-shadow:inset_0_0_0_1px_var(--line)]")}
            onClick={() => setView("iso")}
          >
            <Icon name="map" size={12} /> Iso
          </button>
          <button
            type="button"
            className={cn("inline-flex items-center gap-[6px] text-txt-3 px-[12px] py-[6px] rounded-[5px] text-[12.5px] transition-[background,color] duration-[120ms]", view === "cards" && "bg-bg-3 text-txt [box-shadow:inset_0_0_0_1px_var(--line)]")}
            onClick={() => setView("cards")}
          >
            <Icon name="grid" size={12} /> Cards
          </button>
        </div>
        <button type="button" className="inline-flex items-center gap-[6px] bg-acc font-semibold cursor-pointer px-[14px] py-[8px] text-white rounded-[9px] text-[13px] transition-[background] duration-[120ms] hover:bg-[var(--acc-hover)] border-none" onClick={() => setAddOpen(true)}>
          <Icon name="plus" size={13} /> Add agent
        </button>
      </div>

      <AddAgentModal
        open={addOpen}
        projectId={activeProjectId}
        onClose={() => setAddOpen(false)}
        onProjectChange={(id) => setActiveId(id)}
      />
    </header>
  );
}
