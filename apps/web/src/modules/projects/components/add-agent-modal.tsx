"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { unitForAgent } from "@/components/ui/unit-sprite.utils";
import { useAgents } from "@/modules/agents/hooks/use-agents";
import { categorize } from "@/modules/agents/utils/categorize";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import { useAddInstance, useProject, useProjects } from "../hooks/use-projects";

export type AddAgentModalProps = {
  open: boolean;
  projectId: string | null;
  onClose: () => void;
  onProjectChange?: (id: string) => void;
};

/* ── Category metadata ─────────────────────────────────────────── */

const CAT_META: Record<string, { color: string; bg: string; border: string; fg: string }> = {
  Engineering: { color: "#2A6FDB", bg: "rgba(42,111,219,0.10)",   border: "rgba(42,111,219,0.30)",   fg: "#74a8f0" },
  QA:          { color: "#4eb96f", bg: "rgba(78,185,111,0.10)",   border: "rgba(78,185,111,0.30)",   fg: "#80d29c" },
  Design:      { color: "#ec4899", bg: "rgba(236,72,153,0.10)",   border: "rgba(236,72,153,0.30)",   fg: "#f09ec4" },
  "AI & Data": { color: "#8b5cf6", bg: "rgba(139,92,246,0.10)",   border: "rgba(139,92,246,0.30)",   fg: "#b39dfa" },
  Security:    { color: "#ef4444", bg: "rgba(239,68,68,0.10)",    border: "rgba(239,68,68,0.30)",    fg: "#f48080" },
  Docs:        { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",   border: "rgba(245,158,11,0.30)",   fg: "#fbbf55" },
  Marketing:   { color: "#f97316", bg: "rgba(249,115,22,0.10)",   border: "rgba(249,115,22,0.30)",   fg: "#fb9a55" },
  Research:    { color: "#06b6d4", bg: "rgba(6,182,212,0.10)",    border: "rgba(6,182,212,0.30)",    fg: "#4fd9ea" },
  Strategy:    { color: "#8b5cf6", bg: "rgba(139,92,246,0.10)",   border: "rgba(139,92,246,0.30)",   fg: "#b39dfa" },
  Build:       { color: "#e95420", bg: "rgba(233,84,32,0.10)",    border: "rgba(233,84,32,0.30)",    fg: "#f07a52" },
  Other:       { color: "#9b9089", bg: "rgba(155,144,137,0.08)",  border: "rgba(155,144,137,0.30)",  fg: "#cdc4bd" },
};

function catStyle(cat: string): React.CSSProperties {
  const c = CAT_META[cat] ?? CAT_META.Other!;
  return {
    "--cat-color": c.color,
    "--cat-bg": c.bg,
    "--cat-border": c.border,
    "--cat-fg": c.fg,
  } as React.CSSProperties;
}

function modelColor(m: string | undefined): string {
  if (!m) return "var(--txt-4)";
  if (m.includes("haiku"))  return "var(--working)";
  if (m.includes("opus"))   return "#ffcb6b";
  return "#c792ea";
}

/* ── Main modal ─────────────────────────────────────────────────── */

export function AddAgentModal({ open, projectId, onClose, onProjectChange }: AddAgentModalProps) {
  const [targetId, setTargetId] = useState<string | null>(projectId);
  const projectsQ = useProjects();
  const projects = projectsQ.data;
  const autoPickedRef = useRef(false);

  useEffect(() => {
    if (open) { setTargetId(projectId); autoPickedRef.current = false; }
  }, [open, projectId]);

  useEffect(() => {
    if (!open || targetId || autoPickedRef.current) return;
    if (!projects || projects.length !== 1) return;
    const only = projects[0]!.id;
    autoPickedRef.current = true;
    setTargetId(only);
    onProjectChange?.(only);
  }, [open, targetId, projects, onProjectChange]);

  const handleClose = () => { setTargetId(projectId); onClose(); };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  const content = (
    <div className="aa-backdrop" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="aa-modal" role="dialog" aria-modal="true">
        {targetId ? (
          <AgentPickerStep
            projectId={targetId}
            onChangeProject={() => setTargetId(null)}
            onClose={handleClose}
          />
        ) : (
          <ProjectPickerStep
            onPick={(id) => { setTargetId(id); onProjectChange?.(id); }}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

/* ── Project picker step ────────────────────────────────────────── */

function ProjectPickerStep({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const projectsQ = useProjects();
  const projects = projectsQ.data ?? [];

  return (
    <>
      <div className="aa-head">
        <div className="crest"><Icon name="folder" size={15} /></div>
        <div className="titles">
          <div className="title">Choose a project</div>
          <div className="sub">Select which project to add agents to</div>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="Close">
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="aa-body" style={{ padding: "16px 22px" }}>
        {projectsQ.isLoading ? (
          <Skeleton width="100%" height={120} />
        ) : projects.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--txt-3)", fontSize: 13 }}>
            <p style={{ marginBottom: 12 }}>No projects configured yet.</p>
            <Link href={PAGE_ROUTES.settings} className="btn primary" onClick={onClose}>
              Configure root directory
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p.id)}
                style={{
                  display: "grid", gridTemplateColumns: "auto 1fr auto",
                  gap: 12, alignItems: "center", padding: "10px 14px",
                  background: "var(--bg-2)", border: "1px solid var(--line)",
                  borderRadius: 10, cursor: "pointer", textAlign: "left",
                  fontFamily: "inherit", color: "var(--txt)",
                }}
              >
                <Icon name="folder" size={16} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                  {p.cwd && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--txt-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.cwd}
                    </div>
                  )}
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--txt-3)" }}>
                  {p.instanceCount} agent{p.instanceCount !== 1 ? "s" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Agent picker step ──────────────────────────────────────────── */

function AgentPickerStep({
  projectId,
  onChangeProject,
  onClose,
}: {
  projectId: string;
  onChangeProject: () => void;
  onClose: () => void;
}) {
  const projectQ = useProject(projectId);
  const agentsQ = useAgents();
  const addMut = useAddInstance();

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [view, setView] = useState<"all" | "available">("all");
  const [staged, setStaged] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const agents = agentsQ.data ?? [];

  const rosterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inst of projectQ.data?.meta.roster ?? []) {
      counts[inst.agentId] = (counts[inst.agentId] ?? 0) + 1;
    }
    return counts;
  }, [projectQ.data]);

  // All unique categories present in the agent list
  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const a of agents) seen.add(categorize(a));
    return [
      { id: "all", label: "All", color: null, count: agents.length },
      ...Array.from(seen).map((cat) => ({
        id: cat, label: cat, color: CAT_META[cat]?.color ?? null,
        count: agents.filter((a) => categorize(a) === cat).length,
      })).sort((a, b) => b.count - a.count),
    ];
  }, [agents]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return agents.filter((a) => {
      if (catFilter !== "all" && categorize(a) !== catFilter) return false;
      if (view === "available" && rosterCounts[a.name]) return false;
      if (!ql) return true;
      const blob = `${a.name} ${a.description ?? ""} ${(a.skills ?? []).join(" ")} ${(a.tools ?? []).join(" ")}`.toLowerCase();
      return blob.includes(ql);
    });
  }, [agents, q, catFilter, view, rosterCounts]);

  const inRoster = filtered.filter((a) => rosterCounts[a.name]);
  const notInRoster = filtered.filter((a) => !rosterCounts[a.name]);

  const totalStaged = Object.values(staged).reduce((s, n) => s + n, 0);
  const stagedEntries = Object.entries(staged).map(([id, n]) => ({ agent: agents.find((a) => a.name === id), n })).filter((x) => x.agent);

  const handleSummon = useCallback(async () => {
    if (totalStaged === 0) { onClose(); return; }
    setError(null);
    const entries = Object.entries(staged);
    try {
      for (const [agentId, count] of entries) {
        for (let i = 0; i < count; i++) {
          await new Promise<void>((resolve, reject) => {
            addMut.mutate({ projectId, agentId }, { onSuccess: () => resolve(), onError: reject });
          });
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [staged, projectId, addMut, onClose, totalStaged]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSummon(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleSummon]);

  const projectLabel = projectQ.data?.meta.name ?? projectId;

  return (
    <>
      <div className="aa-head">
        <div className="crest"><Icon name="plus" size={16} /></div>
        <div className="titles">
          <div className="title">Add agent to office</div>
          <div className="sub">
            Adding to <span className="b">{projectLabel}</span>
            <span style={{ color: "var(--txt-4)" }}>·</span>
            <button type="button" className="switch-proj" onClick={onChangeProject}>Change project</button>
            <span style={{ color: "var(--txt-4)" }}>·</span>
            <span>click to stage, summon to commit</span>
          </div>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="Close">
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="aa-toolbar">
        <div className="search">
          <Icon name="search" size={13} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name, description, or skill…"
          />
        </div>
        <div className="seg">
          <button type="button" className={view === "all" ? "active" : ""} onClick={() => setView("all")}>All</button>
          <button type="button" className={view === "available" ? "active" : ""} onClick={() => setView("available")}>Not in office</button>
        </div>
      </div>

      <div className="aa-cat-row">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`aa-cat${catFilter === c.id ? " active" : ""}`}
            onClick={() => setCatFilter(c.id)}
          >
            {c.color && <span className="dot" style={{ background: c.color }} />}
            {c.label}
            <span className="pip">{c.count}</span>
          </button>
        ))}
      </div>

      <div className="aa-body">
        {error && (
          <div style={{ marginBottom: 10, color: "var(--error)", fontSize: 12, fontFamily: "var(--font-mono)", padding: "8px 12px", background: "color-mix(in oklch, var(--error) 12%, transparent)", borderRadius: 6 }}>
            {error}
          </div>
        )}
        {agentsQ.isLoading ? (
          <Skeleton width="100%" height={200} />
        ) : filtered.length === 0 ? (
          <div className="aa-empty">
            <div className="glyph"><Icon name="search" size={20} /></div>
            <div style={{ fontSize: 14, color: "var(--txt-2)" }}>
              {q ? `No agents match "${q}"` : "No agents in this category"}
            </div>
          </div>
        ) : (
          <>
            {view === "all" && notInRoster.length > 0 && (
              <>
                <div className="aa-section-head">
                  <span className="label">Available</span>
                  <span className="pip">{notInRoster.length}</span>
                  <span className="line" />
                </div>
                {notInRoster.map((a) => (
                  <AgentRow
                    key={a.name}
                    name={a.name}
                    description={a.description}
                    defaultModel={a.defaultModel}
                    unit={a.unit}
                    category={categorize(a)}
                    rosterCount={rosterCounts[a.name] ?? 0}
                    stagedCount={staged[a.name] ?? 0}
                    onAdd={() => setStaged((prev) => ({ ...prev, [a.name]: (prev[a.name] ?? 0) + 1 }))}
                  />
                ))}
              </>
            )}
            {view === "all" && inRoster.length > 0 && (
              <>
                <div className="aa-section-head">
                  <span className="label">Already in office</span>
                  <span className="pip">{inRoster.length}</span>
                  <span className="line" />
                </div>
                {inRoster.map((a) => (
                  <AgentRow
                    key={a.name}
                    name={a.name}
                    description={a.description}
                    defaultModel={a.defaultModel}
                    unit={a.unit}
                    category={categorize(a)}
                    rosterCount={rosterCounts[a.name] ?? 0}
                    stagedCount={staged[a.name] ?? 0}
                    onAdd={() => setStaged((prev) => ({ ...prev, [a.name]: (prev[a.name] ?? 0) + 1 }))}
                  />
                ))}
              </>
            )}
            {view === "available" && notInRoster.map((a) => (
              <AgentRow
                key={a.name}
                name={a.name}
                description={a.description}
                defaultModel={a.defaultModel}
                unit={a.unit}
                category={categorize(a)}
                rosterCount={0}
                stagedCount={staged[a.name] ?? 0}
                onAdd={() => setStaged((prev) => ({ ...prev, [a.name]: (prev[a.name] ?? 0) + 1 }))}
              />
            ))}
          </>
        )}
      </div>

      <div className="aa-foot">
        <div className="summary">
          {stagedEntries.length === 0 ? (
            <div className="text"><span className="empty">No agents staged yet</span></div>
          ) : (
            <>
              <div className="avs">
                {stagedEntries.slice(0, 5).map(({ agent }) => (
                  <div key={agent!.name} className="av" title={agent!.name}>
                    <AgentAvatar unit={unitForAgent(agent!.name, agent!.unit)} size={22} />
                  </div>
                ))}
                {stagedEntries.length > 5 && <div className="more">+{stagedEntries.length - 5}</div>}
              </div>
              <div className="text">
                <span className="b">{totalStaged}</span> agent{totalStaged !== 1 ? "s" : ""} to summon
                {totalStaged !== stagedEntries.length && (
                  <span style={{ color: "var(--txt-4)" }}> · {stagedEntries.length} distinct</span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={`btn-done${totalStaged === 0 ? " empty" : ""}`}
            onClick={handleSummon}
            disabled={addMut.isPending}
          >
            <Icon name="check" size={12} />
            {addMut.isPending ? "Adding…" : totalStaged === 0 ? "Done" : `Summon ${totalStaged}`}
            <span className="kbd">⌘ ↵</span>
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Agent row ──────────────────────────────────────────────────── */

function AgentRow({
  name, description, defaultModel, unit, category,
  rosterCount, stagedCount, onAdd,
}: {
  name: string;
  description?: string | null;
  defaultModel?: string | null;
  unit?: string | null;
  category: string;
  rosterCount: number;
  stagedCount: number;
  onAdd: () => void;
}) {
  const inOffice = rosterCount > 0;
  const added = stagedCount > 0 || inOffice;
  const unitSel = unitForAgent(name, unit);

  return (
    <div className={`aa-row${added ? " added" : ""}`} style={catStyle(category)}>
      <div className="av">
        <AgentAvatar unit={unitSel} size={36} />
      </div>
      <div className="info">
        <div className="row1">
          <span className="name">{name}</span>
          {defaultModel && (
            <span className="model-tag">
              <span className="d" style={{ background: modelColor(defaultModel) }} />
              {defaultModel.replace("claude-", "").replace(/-\d+(-\d+)?$/, "")}
            </span>
          )}
          <span className="cat-tag">
            <span className="dot" />
            {category.toLowerCase()}
          </span>
        </div>
        {description && <div className="desc">{description}</div>}
        {inOffice && (
          <div className="in-roster">
            <span className="pip"><Icon name="check" size={9} /> in office</span>
            <span>· already summoned {rosterCount}×</span>
          </div>
        )}
      </div>
      <div className="aa-add-wrap">
        <button
          type="button"
          className={`aa-add${added ? " added" : ""}`}
          onClick={onAdd}
        >
          {added ? (
            <>
              <Icon name="check" size={12} /> Added
              <span className="badge">{inOffice ? rosterCount + stagedCount : stagedCount}</span>
            </>
          ) : (
            <><Icon name="plus" size={12} /> Add</>
          )}
        </button>
      </div>
    </div>
  );
}
