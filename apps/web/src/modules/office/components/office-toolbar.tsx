"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { ActionBar } from "@/components/ui/action-bar";
import { cn } from "@/lib/cn";
import { useActiveProjectStore } from "@/lib/active-project-store";
import { useProject, useGitStatus } from "@/modules/projects/hooks/use-projects";
import { AddAgentModal } from "@/modules/projects/components/add-agent-modal";
import { useFlutterStore } from "@/lib/flutter-store";
import { useFlutterDevices } from "@/modules/flutter/hooks/use-flutter-devices";
import { useDevServerStore } from "@/lib/dev-server-store";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import type { OfficeView } from "../hooks/use-office-store";
import type { DetectedCommand } from "@/app/api/projects/[id]/dev/route";
import type { ProcessInfo } from "@/app/api/processes/route";

// Shared compact button style for all toolbar action buttons
const TBTN = "inline-flex items-center gap-[5px] px-[9px] h-[30px] rounded-[7px] text-[12px] text-txt-2 border border-transparent hover:bg-bg-3 hover:text-txt transition-[background,color,border-color] duration-[120ms] cursor-pointer select-none shrink-0";

type InstallState = "unknown" | "needed" | "installing" | "done";

type RunState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "running"; pid: number; port: number | null; url: string | null }
  | { phase: "stopping" };

export function DevServerButton({ projectId }: { projectId: string }) {
  const [install, setInstall] = useState<InstallState>("unknown");
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const store = useDevServerStore();

  const devQ = useQuery({
    queryKey: ["project-dev-config", projectId],
    queryFn: () =>
      fetch(`/api/projects/${projectId}/dev`)
        .then((r) => r.json() as Promise<{ hasPackageJson: boolean; hasNodeModules: boolean; commands: DetectedCommand[] }>),
    staleTime: 60_000,
  });

  const commands = devQ.data?.commands ?? [];
  const hasPackageJson = devQ.data?.hasPackageJson ?? false;

  // Sync install state from query data (only when we don't have a local override)
  useEffect(() => {
    if (!devQ.data || install !== "unknown") return;
    setInstall(devQ.data.hasNodeModules ? "done" : devQ.data.hasPackageJson ? "needed" : "done");
  }, [devQ.data, install]);

  // Reconcile UI state with already-running processes (once per project, persisted in store)
  useEffect(() => {
    if (commands.length === 0 || store.isReconciled(projectId)) return;
    store.markReconciled(projectId);
    fetch("/api/processes")
      .then((r) => r.json() as Promise<ProcessInfo[]>)
      .then((processes) => {
        const mine = processes.filter((p) => p.projectId === projectId);
        if (mine.length === 0) return;
        for (const proc of mine) {
          const alreadyTracked = commands.some((cmd) => {
            const s = store.getRunState(projectId, cmd.key);
            return s.phase === "running" && s.pid === proc.pid;
          });
          if (alreadyTracked) continue;
          const matched =
            commands.find((cmd) => {
              const scriptName = cmd.argv[cmd.argv.length - 1] ?? "";
              return proc.cmd.includes(scriptName) || proc.cmd.includes(cmd.key);
            }) ?? commands[0]!;
          if (matched && store.getRunState(projectId, matched.key).phase === "idle") {
            store.setRunState(projectId, matched.key, {
              phase: "running",
              pid: proc.pid,
              port: proc.port,
              url: `http://localhost:${proc.port}`,
            });
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands.length, projectId]);

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
    return store.getRunState(projectId, key) as RunState;
  }

  function setKeyState(key: string, s: RunState) {
    store.setRunState(projectId, key, s);
  }

  async function runInstall() {
    setInstall("installing");
    try {
      const res = await fetch(`/api/projects/${projectId}/install`, { method: "POST" });
      if (res.ok) {
        setInstall("done");
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

  const runningCount = commands.filter((cmd) => store.getRunState(projectId, cmd.key).phase === "running").length;
  const busyInstall = install === "needed" || install === "installing";

  // No package.json and no detected commands (e.g. non-JS project) — hide entirely
  if (install !== "unknown" && install !== "installing" && !hasPackageJson && commands.length === 0) {
    return null;
  }

  // ── Install button ──────────────────────────────────────────────────────────
  const installBtn = install === "needed" ? (
    <button type="button" className={TBTN} onClick={() => { void runInstall(); }}>
      <Icon name="download" size={12} /> Install
    </button>
  ) : install === "installing" ? (
    <button type="button" className={TBTN} disabled>
      <Icon name="refresh" size={12} className="[animation:spin_1s_linear_infinite]" /> Installing…
    </button>
  ) : null;

  // ── Single command: inline buttons ─────────────────────────────────────────
  if (commands.length === 1) {
    const cmd = commands[0]!;
    const s = getState(cmd.key);
    return (
      <span className="inline-flex items-center gap-1">
        {installBtn}
        {s.phase === "idle" && (
          <button type="button" className={TBTN} onClick={() => { void startCmd(cmd.key); }} disabled={busyInstall} title="Start dev server">
            <Icon name="play" size={11} /> Dev
          </button>
        )}
        {(s.phase === "starting" || s.phase === "stopping") && (
          <button type="button" className={TBTN} disabled>
            <Icon name="refresh" size={11} className="[animation:spin_1s_linear_infinite]" />
            {s.phase === "starting" ? "Starting…" : "Stopping…"}
          </button>
        )}
        {s.phase === "running" && (
          <>
            {s.port !== null && (
              <a
                href={s.url ?? "#"} target="_blank" rel="noopener noreferrer"
                className="font-mono text-[11px] text-[var(--working)] no-underline px-[7px] h-[30px] inline-flex items-center rounded-[7px] bg-[color-mix(in_srgb,var(--working)_10%,transparent)] border border-[color-mix(in_srgb,var(--working)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--working)_18%,transparent)] transition-colors"
                title={`Open ${s.url}`}
              >
                :{s.port}
              </a>
            )}
            <button type="button" className={TBTN} onClick={() => { void stopCmd(cmd.key); }} title="Stop dev server">
              <Icon name="stop" size={11} /> Stop
            </button>
          </>
        )}
      </span>
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

export function FlutterDeviceButton() {
  const setOpen = useFlutterStore((s) => s.setOpen);
  const devicesQ = useFlutterDevices();
  const devices = devicesQ.data?.devices ?? [];
  const available = devicesQ.data?.available ?? false;
  const connected = devices.filter((d) => d.status === "device");
  const hasDevice = connected.length > 0;

  if (!devicesQ.isSuccess || !available) return null;

  const label = hasDevice
    ? (connected.length > 1 ? `${connected.length} devices` : (connected[0]?.model ?? "Device"))
    : "No device";

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title={hasDevice ? `${connected.length} device${connected.length !== 1 ? "s" : ""} connected — open Flutter manager` : "No Android device connected"}
      className={cn(TBTN, hasDevice ? "text-[#54C5F8] hover:text-[#54C5F8]" : "")}
    >
      <Icon name="smartphone" size={12} />
      {label}
    </button>
  );
}

export function OpenFolderButton({ projectId }: { projectId: string }) {
  return (
    <button type="button" className={TBTN} title="Open project folder"
      onClick={() => { void fetch(`/api/projects/${projectId}/open-folder`, { method: "POST" }); }}>
      <Icon name="folder" size={13} />
    </button>
  );
}

export function OpenInVSCodeButton({ projectId }: { projectId: string }) {
  return (
    <button type="button" className={TBTN} title="Open in VS Code"
      onClick={() => { void fetch(`/api/projects/${projectId}/open-folder?app=code`, { method: "POST" }); }}>
      <Icon name="code" size={13} />
    </button>
  );
}

export function GitStatusButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const gitQ = useGitStatus(projectId, true);
  const git = gitQ.data;
  if (!git?.isGit || !git.branch) return null;
  const dirty = git.filesChanged > 0;
  return (
    <button
      type="button"
      className={cn(TBTN, dirty ? "text-[var(--acc-2)]" : "")}
      title={[
        `Branch: ${git.branch}`,
        dirty ? `${git.filesChanged} changed, +${git.added} -${git.removed}` : "clean",
        git.ahead ? `${git.ahead} ahead` : "",
        git.behind ? `${git.behind} behind` : "",
      ].filter(Boolean).join(" · ")}
      onClick={() => router.push(PAGE_ROUTES.project(projectId))}
    >
      <Icon name="branch" size={12} />
      <span className="font-mono">{git.branch}</span>
      {dirty && <span className="text-[10.5px] font-mono text-txt-4">·{git.filesChanged}</span>}
      {git.ahead > 0 && <span className="text-[10.5px] font-mono text-[var(--ok)]">↑{git.ahead}</span>}
      {git.behind > 0 && <span className="text-[10.5px] font-mono text-yellow-400">↓{git.behind}</span>}
    </button>
  );
}

export function KillAgentsButton({ projectId }: { projectId: string }) {
  const countQ = useQuery({
    queryKey: ["project-running-count", projectId],
    queryFn: () =>
      fetch(`/api/runs?project=${projectId}&limit=100`)
        .then((r) => r.json() as Promise<Array<{ status: string }>>)
        .then((rs) => rs.filter((r) => r.status === "running").length),
    refetchInterval: 4000,
    staleTime: 2000,
  });
  const count = countQ.data ?? 0;
  if (count === 0) return null;

  async function killAll() {
    await fetch("/api/runs/abort-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
  }

  return (
    <button
      type="button"
      className={cn(TBTN, "text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_12%,transparent)] hover:text-[var(--error)] hover:border-[color-mix(in_srgb,var(--error)_25%,transparent)]")}
      title={`Stop all ${count} running agent${count !== 1 ? "s" : ""}`}
      onClick={() => { void killAll(); }}
    >
      <Icon name="stop" size={11} />
      Stop {count}
    </button>
  );
}

type BuildPhase = "idle" | "building" | "done" | "error";

export function BuildButton({ projectId }: { projectId: string }) {
  const [phase, setPhase] = useState<BuildPhase>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  const buildQ = useQuery({
    queryKey: ["project-build-check", projectId],
    queryFn: () =>
      fetch(`/api/projects/${projectId}/build`)
        .then((r) => r.json() as Promise<{ hasBuild: boolean }>),
    staleTime: 60_000,
  });

  const hasBuild = buildQ.data?.hasBuild ?? false;

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
      <button type="button" className={TBTN} disabled>
        <Icon name="refresh" size={12} className="[animation:spin_1s_linear_infinite]" /> Building…
      </button>
    );
  }
  if (phase === "done") {
    return (
      <button type="button" className={cn(TBTN, "text-[var(--ok)]")} disabled>
        <Icon name="check" size={12} /> Built
      </button>
    );
  }
  if (phase === "error") {
    return (
      <button type="button" className={cn(TBTN, "text-[var(--error)]")} disabled>
        <Icon name="x" size={12} /> Failed
      </button>
    );
  }
  return (
    <button type="button" className={TBTN} onClick={() => { void startBuild(); }} title="Build project">
      <Icon name="zap" size={12} /> Build
    </button>
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
        <ActionBar
          actions={[
            ...(activeProjectId && project?.meta.cwd ? [
              { key: `git-${activeProjectId}`, element: <GitStatusButton projectId={activeProjectId} /> },
              { key: "open-folder", element: <OpenFolderButton projectId={activeProjectId} /> },
              { key: "open-vscode", element: <OpenInVSCodeButton projectId={activeProjectId} /> },
              { key: `build-${activeProjectId}`, element: <BuildButton key={`build-${activeProjectId}`} projectId={activeProjectId} /> },
              { key: activeProjectId, element: <DevServerButton key={activeProjectId} projectId={activeProjectId} /> },
              { key: `kill-${activeProjectId}`, element: <KillAgentsButton projectId={activeProjectId} /> },
            ] : []),
            { key: "flutter-device", element: <FlutterDeviceButton /> },
          ]}
        />
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
