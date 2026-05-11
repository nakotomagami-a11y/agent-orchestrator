"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ModalShell } from "@/components/ui/modal-shell";
import { TextInput } from "@/components/ui/text-input";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgents } from "@/modules/agents/hooks/use-agents";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import { useAddInstance, useProject, useProjects } from "../hooks/use-projects";

export type AddAgentModalProps = {
  open: boolean;
  /** Active project from the switcher; if null we show a project picker step first. */
  projectId: string | null;
  onClose: () => void;
  /** Called when the user picks a project inside the modal — syncs the switcher. */
  onProjectChange?: (id: string) => void;
};

export function AddAgentModal({
  open,
  projectId,
  onClose,
  onProjectChange,
}: AddAgentModalProps) {
  const [targetId, setTargetId] = useState<string | null>(projectId);

  // When the modal opens, snap to whatever the parent says is active.
  useEffect(() => {
    if (open) setTargetId(projectId);
  }, [open, projectId]);

  const handleClose = () => {
    setTargetId(projectId);
    onClose();
  };

  const handlePickProject = (id: string) => {
    setTargetId(id);
    onProjectChange?.(id);
  };

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={targetId ? "Add agent" : "Add agent — pick a project"}
      size="lg"
      footer={
        <button type="button" className="btn" onClick={handleClose}>
          Done
        </button>
      }
    >
      {targetId ? (
        <AgentPickerStep
          projectId={targetId}
          onChangeProject={() => setTargetId(null)}
        />
      ) : (
        <ProjectPickerStep onPick={handlePickProject} onClose={handleClose} />
      )}
    </ModalShell>
  );
}

function ProjectPickerStep({
  onPick,
  onClose,
}: {
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const projectsQ = useProjects();
  const projects = projectsQ.data ?? [];

  if (projectsQ.isLoading) {
    return <Skeleton width="100%" height={120} />;
  }

  if (projects.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--txt-3)", fontSize: 13 }}>
        <p style={{ marginBottom: 12 }}>
          No projects yet — agents are added to a project's roster.
        </p>
        <Link
          href={PAGE_ROUTES.settings}
          className="btn primary"
          onClick={onClose}
        >
          Configure projects root
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--txt-3)" }}>
        Which project should the new agent join?
      </span>
      {projects.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p.id)}
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 12,
            alignItems: "center",
            padding: "10px 14px",
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
            color: "var(--txt)",
          }}
        >
          <Icon name="folder" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
            {p.cwd ? (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--txt-3)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.cwd}
              </div>
            ) : null}
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--txt-3)" }}>
            {p.instanceCount} agent{p.instanceCount === 1 ? "" : "s"}
          </span>
        </button>
      ))}
    </div>
  );
}

function AgentPickerStep({
  projectId,
  onChangeProject,
}: {
  projectId: string;
  onChangeProject: () => void;
}) {
  const projectQ = useProject(projectId);
  const agentsQ = useAgents();
  const addMut = useAddInstance();
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const agents = agentsQ.data ?? [];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => {
      if (a.name.toLowerCase().includes(q)) return true;
      if (a.description?.toLowerCase().includes(q)) return true;
      if (a.skills?.some((s) => s.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [agents, filter]);

  const rosterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inst of projectQ.data?.meta.roster ?? []) {
      counts[inst.agentId] = (counts[inst.agentId] ?? 0) + 1;
    }
    return counts;
  }, [projectQ.data]);

  const projectLabel = projectQ.data?.meta.name ?? projectId;

  const handleAdd = (agentName: string) => {
    setError(null);
    addMut.mutate(
      { projectId, agentId: agentName },
      {
        onError: (err) => setError(err instanceof Error ? err.message : String(err)),
      },
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--txt-2)" }}>
          Adding to{" "}
          <strong style={{ color: "var(--txt)" }}>{projectLabel}</strong>
        </span>
        <button
          type="button"
          onClick={onChangeProject}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--acc)",
            fontFamily: "inherit",
            fontSize: 12,
            cursor: "pointer",
            padding: 0,
          }}
        >
          Change project
        </button>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--txt-3)" }}>
          Click to add · click again to add another
        </span>
      </div>

      <TextInput
        placeholder="Filter by name, description, or skill…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        autoFocus
      />

      {error ? (
        <div
          style={{
            color: "var(--error)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            padding: "8px 12px",
            background: "color-mix(in oklch, var(--error) 12%, transparent)",
            borderRadius: 6,
          }}
        >
          {error}
        </div>
      ) : null}

      {agentsQ.isLoading ? (
        <Skeleton width="100%" height={120} />
      ) : agents.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--txt-3)", fontSize: 13 }}>
          No agent definitions found in <code>~/.claude/agents/</code>.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((a) => {
            const count = rosterCounts[a.name] ?? 0;
            const busy = addMut.isPending && addMut.variables?.agentId === a.name;
            return (
              <button
                key={a.name}
                type="button"
                onClick={() => handleAdd(a.name)}
                disabled={addMut.isPending}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 14px",
                  background: busy ? "var(--bg-3)" : "var(--bg-1)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  cursor: addMut.isPending ? "wait" : "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  opacity: addMut.isPending && !busy ? 0.55 : 1,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</span>
                    {a.defaultModel ? (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--txt-3)",
                        }}
                      >
                        {a.defaultModel}
                      </span>
                    ) : null}
                  </div>
                  {a.description ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--txt-2)",
                        marginTop: 3,
                        lineHeight: 1.35,
                      }}
                    >
                      {a.description}
                    </div>
                  ) : null}
                  {count > 0 ? (
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        color: "var(--txt-3)",
                        marginTop: 4,
                      }}
                    >
                      already in roster: {count}
                    </div>
                  ) : null}
                </div>
                <span
                  style={{
                    padding: "5px 10px",
                    borderRadius: 4,
                    background: busy ? "var(--bg-2)" : "var(--acc)",
                    color: busy ? "var(--txt-2)" : "var(--acc-ink)",
                    fontSize: 11.5,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {busy ? (
                    "adding…"
                  ) : (
                    <>
                      <Icon name="plus" size={12} /> Add
                    </>
                  )}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: "var(--txt-3)" }}>
              No agents match “{filter}”.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
