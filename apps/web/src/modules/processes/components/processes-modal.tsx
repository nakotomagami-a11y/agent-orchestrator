"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@agent-office/shared/hooks/api";
import { ModalShell } from "@/components/ui/modal-shell";
import { Icon } from "@/components/ui/icon";
import { useProcessesStore } from "@/lib/processes-store";
import { useProcesses, type ProcessInfo } from "../hooks/use-processes";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function fmtMem(mb: number): string {
  if (mb === 0) return "—";
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

function fmtUptime(startedAt: number): string {
  if (!startedAt) return "—";
  const ms = Math.max(0, Date.now() - startedAt);
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function fmtAgo(startedAt: number): string {
  if (!startedAt) return "—";
  const ms = Math.max(0, Date.now() - startedAt);
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function detectFramework(name: string, cmd: string): string {
  const c = cmd.toLowerCase();
  const n = name.toLowerCase();
  if (c.includes("next") || n === "next-server") return "Next.js";
  if (n === "bun" || c.startsWith("bun ")) return "Bun";
  if (n === "node" || c.includes("node ")) return "Node.js";
  if (n === "python" || n === "python3") return "Python";
  if (n === "ruby") return "Ruby";
  if (n === "java") return "Java";
  if (n === "go") return "Go";
  if (n === "redis-server") return "Redis";
  if (n === "postgres" || n === "postgresql") return "PostgreSQL";
  if (n === "nginx") return "nginx";
  if (n === "caddy") return "Caddy";
  if (n === "dockerd") return "Docker daemon";
  return name;
}

type Group = { id: string; label: string; processes: ProcessInfo[] };

function groupByProject(processes: ProcessInfo[]): Group[] {
  const map = new Map<string, Group>();
  for (const p of processes) {
    const key = p.projectId ?? "__other__";
    const label = p.projectName ?? "Other";
    if (!map.has(key)) map.set(key, { id: key, label, processes: [] });
    map.get(key)!.processes.push(p);
  }
  const groups = Array.from(map.values());
  return [
    ...groups.filter((g) => g.label !== "Other").sort((a, b) => a.label.localeCompare(b.label)),
    ...groups.filter((g) => g.label === "Other"),
  ];
}

/* ------------------------------------------------------------------ */
/* Server card                                                          */
/* ------------------------------------------------------------------ */

function ServerCard({
  process: p,
  onKill,
  killing,
}: {
  process: ProcessInfo;
  onKill: () => void;
  killing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const framework = detectFramework(p.name, p.cmd);
  const isLocal = p.address === "127.0.0.1" || p.address === "::1" || p.address === "0.0.0.0" || p.address === "::";
  const memPct = Math.min(100, p.memMb / 10); // rough visual scale: 1 GB = 100%

  return (
    <>
      <div
        className={`srv-card ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="status-led" />
        <span
          className="srv-port-chip"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="proto">:tcp</span>
          {p.port}
          {isLocal && (
            <a
              href={`http://localhost:${p.port}`}
              target="_blank"
              rel="noopener noreferrer"
              className="open-out"
              title="Open in browser"
            >
              <Icon name="globe" size={10} />
            </a>
          )}
        </span>
        <div className="info">
          <div className="row1">
            <span>{p.name}</span>
            {framework !== p.name && (
              <span className="framework">{framework}</span>
            )}
          </div>
          <div className="row2">
            <span className="cmd" title={p.cmd}>{p.cmd || "—"}</span>
          </div>
          <div className="row3">
            <span className="item"><span className="l">PID</span><span className="v">{p.pid}</span></span>
            <span className="sep" />
            <span className="item"><span className="l">up</span><span className="v">{fmtUptime(p.startedAt)}</span></span>
            <span className="sep" />
            <span className="item"><span className="l">mem</span><span className="v">{fmtMem(p.memMb)}</span></span>
          </div>
        </div>
        <div className="actions" onClick={(e) => e.stopPropagation()}>
          {isLocal && (
            <a
              href={`http://localhost:${p.port}`}
              target="_blank"
              rel="noopener noreferrer"
              className="open"
              title="Open in browser"
            >
              <Icon name="globe" size={13} />
            </a>
          )}
          <button title="Stop process" className="stop" onClick={onKill} disabled={killing}>
            <Icon name={killing ? "refresh" : "x"} size={14} />
          </button>
        </div>
        <span className="chev-trigger">
          <Icon name="chevron-down" size={11} />
        </span>
      </div>

      {open && (
        <div className="srv-detail">
          <div className="kv-list">
            <div className="kv"><span className="k">PID</span><span className="v">{p.pid}</span></div>
            <div className="kv"><span className="k">Working dir</span><span className="v">{p.cwd || "—"}</span></div>
            <div className="kv"><span className="k">Command</span><span className="v">{p.cmd || "—"}</span></div>
            <div className="kv"><span className="k">Started</span><span className="v">{fmtAgo(p.startedAt)} · up {fmtUptime(p.startedAt)}</span></div>
            <div className="kv"><span className="k">Address</span><span className="v">{p.address}:{p.port}</span></div>
          </div>

          <div className="srv-meter">
            <div className="head">
              <Icon name="cpu" size={11} /> Memory
              <span className="val">{fmtMem(p.memMb)}</span>
            </div>
            <div className="mem-bar">
              <div className="fill" style={{ width: `${memPct}%` }} />
            </div>
          </div>

          <div className="actions-row">
            {isLocal && (
              <a
                href={`http://localhost:${p.port}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
              >
                <Icon name="globe" size={12} /> Open localhost:{p.port}
              </a>
            )}
            <button className="btn btn-danger" onClick={onKill} disabled={killing}>
              <Icon name={killing ? "refresh" : "x"} size={12} /> {killing ? "Killing…" : "Kill process"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                                */
/* ------------------------------------------------------------------ */

export function ProcessesModal() {
  const open = useProcessesStore((s) => s.open);
  const setOpen = useProcessesStore((s) => s.setOpen);
  const processesQ = useProcesses(open);
  const queryClient = useQueryClient();

  const processes = processesQ.data ?? [];
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q) return processes;
    const low = q.toLowerCase();
    return processes.filter((p) => {
      const blob = `${p.name} ${p.cmd} ${p.port} ${p.projectName ?? ""}`.toLowerCase();
      return blob.includes(low);
    });
  }, [processes, q]);

  const groups = useMemo(() => groupByProject(filtered), [filtered]);

  const totalMem = processes.reduce((s, p) => s + p.memMb, 0);
  const projectCount = processes.filter((p) => !!p.projectId).length;
  const [killing, setKilling] = useState<Set<number>>(new Set());
  const [killError, setKillError] = useState<string | null>(null);

  async function handleKill(pid: number) {
    setKilling((prev) => new Set(prev).add(pid));
    setKillError(null);
    try {
      await apiFetch(`/api/processes/${pid}`, { method: "DELETE" });
      // Optimistically remove from cache so the card disappears immediately
      queryClient.setQueryData<ProcessInfo[]>(["processes"], (old) =>
        old ? old.filter((p) => p.pid !== pid) : old
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Kill failed";
      setKillError(`PID ${pid}: ${msg}`);
    } finally {
      setKilling((prev) => { const s = new Set(prev); s.delete(pid); return s; });
      void queryClient.invalidateQueries({ queryKey: ["processes"] });
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      bareContent
      maxWidth={680}
      className="ao-modal"
      closeLabel="Close running servers"
    >
          {/* Header */}
          <div className="srv-head">
            <div className="icon" aria-hidden="true">
              <Icon name="terminal" size={16} />
            </div>
            <div className="titles">
              <div className="title">Running servers</div>
              <div className="sub">processes listening on a port · refreshes every 5s</div>
            </div>
            <button
              className="refresh"
              title="Refresh now"
              onClick={() => processesQ.refetch()}
            >
              <Icon name="refresh" size={15} />
            </button>
            <button
              className="close"
              title="Close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          {/* Stats bar */}
          <div className="srv-stats">
            <div className="stat">
              <span className="l">Total</span>
              <span className="v">{processes.length}<span className="unit"> processes</span></span>
            </div>
            <div className="divider" />
            <div className="stat">
              <span className="l">This project</span>
              <span className="v">{projectCount}<span className="unit"> servers</span></span>
            </div>
            <div className="divider" />
            <div className="stat">
              <span className="l">Memory</span>
              <span className="v">{fmtMem(totalMem)}</span>
            </div>
            <div className="divider" />
            <div className="stat">
              <span className="l">Status</span>
              <span className="v">
                <span className="badge ok dot" style={{ fontSize: 10 }}>
                  {processes.length} running
                </span>
              </span>
            </div>
          </div>

          {/* Toolbar */}
          <div className="srv-toolbar">
            <div className="search">
              <Icon name="search" size={13} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, command, port…"
                autoFocus
              />
            </div>
          </div>

          {killError && (
            <div style={{ padding: "6px 16px", background: "var(--ao-danger-bg, #3a1a1a)", color: "var(--ao-danger, #f87171)", fontSize: 12, fontFamily: "var(--ao-font-mono)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span>{killError}</span>
              <button onClick={() => setKillError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}>✕</button>
            </div>
          )}

          {/* Body */}
          <div className="srv-body">
            {processesQ.isLoading ? (
              <div className="srv-loading">
                <Icon name="refresh" size={18} />
                <span>Scanning ports…</span>
              </div>
            ) : groups.length === 0 ? (
              <div className="srv-empty">
                <div className="glyph">🛰</div>
                <div>{q ? "No matching servers." : "No listening processes found."}</div>
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="srv-group">
                  <div className="srv-group-head">
                    <span className="name">
                      {g.label === "Other" ? "Other system processes" : g.label}
                    </span>
                    <span className="count">{g.processes.length}</span>
                    <span className="line" />
                    {g.label !== "Other" && (
                      <span className="extra">
                        {fmtMem(g.processes.reduce((s, p) => s + p.memMb, 0))}
                      </span>
                    )}
                  </div>
                  {g.processes.map((p) => (
                    <ServerCard
                      key={p.pid}
                      process={p}
                      onKill={() => handleKill(p.pid)}
                      killing={killing.has(p.pid)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="srv-foot">
            <div className="hint">
              <Icon name="server" size={11} />
              <span>scanning <kbd>localhost</kbd> ports via <kbd>ss -tlnp</kbd></span>
              <span className="lag">refreshed {processesQ.dataUpdatedAt ? fmtAgo(processesQ.dataUpdatedAt) : "—"}</span>
            </div>
            <div className="right">
              <button className="lim-btn ghost" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
    </ModalShell>
  );
}
