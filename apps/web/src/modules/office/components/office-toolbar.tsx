"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { useActiveProjectStore } from "@/lib/active-project-store";
import { useProject } from "@/modules/projects/hooks/use-projects";
import { AddAgentModal } from "@/modules/projects/components/add-agent-modal";
import type { OfficeView } from "../hooks/use-office-store";

type DevState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "running"; pid: number; port: number; url: string }
  | { phase: "stopping" };

export function DevServerButton({ projectId }: { projectId: string }) {
  const [dev, setDev] = useState<DevState>({ phase: "idle" });

  async function start() {
    setDev({ phase: "starting" });
    try {
      const res = await fetch(`/api/projects/${projectId}/dev`, { method: "POST" });
      const body = await res.json() as { port?: number; url?: string; pid?: number; error?: string };
      if (!res.ok) {
        setDev({ phase: "idle" });
        return;
      }
      setDev({ phase: "running", pid: body.pid ?? 0, port: body.port ?? 0, url: body.url ?? "" });
    } catch {
      setDev({ phase: "idle" });
    }
  }

  async function stop() {
    if (dev.phase !== "running") return;
    const { pid } = dev;
    setDev({ phase: "stopping" });
    try {
      await fetch(`/api/processes/${pid}`, { method: "DELETE" });
    } catch { /* best-effort */ }
    setDev({ phase: "idle" });
  }

  if (dev.phase === "idle") {
    return (
      <button type="button" className="btn sm ghost" onClick={() => { void start(); }}>
        <Icon name="play" size={12} /> Dev server
      </button>
    );
  }

  if (dev.phase === "starting") {
    return (
      <button type="button" className="btn sm ghost" disabled>
        <Icon name="refresh" size={12} style={{ animation: "spin 1s linear infinite" }} /> Starting…
      </button>
    );
  }

  if (dev.phase === "stopping") {
    return (
      <button type="button" className="btn sm ghost" disabled>
        <Icon name="refresh" size={12} style={{ animation: "spin 1s linear infinite" }} /> Stopping…
      </button>
    );
  }

  // running
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <a
        href={dev.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--txt-2)",
          textDecoration: "none",
          padding: "2px 6px",
          borderRadius: 4,
          background: "color-mix(in srgb, var(--working) 15%, transparent)",
          border: "1px solid color-mix(in srgb, var(--working) 30%, transparent)",
        }}
        title={`Open ${dev.url}`}
      >
        :{dev.port}
      </a>
      <button type="button" className="btn sm ghost" onClick={() => { void stop(); }} title="Stop dev server">
        <Icon name="stop" size={12} /> Stop
      </button>
    </span>
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
    <header className="of-head">
      <div className="titles">
        <h1>
          The office
          <span className="kicker">
            {activeProjectId ? (
              <>
                · <span className="b">{rosterCount} agent{rosterCount === 1 ? "" : "s"}</span>
                {project ? <> in {project.meta.name}</> : null}
                {" · "}
                <span className="b" style={workingCount > 0 ? { color: "var(--working)" } : undefined}>
                  {workingCount} working
                </span>
              </>
            ) : (
              <> · {agentCount} agent{agentCount === 1 ? "" : "s"}</>
            )}
          </span>
        </h1>
      </div>

      <div className="right">
        {activeProjectId && project?.meta.cwd && (
          <DevServerButton projectId={activeProjectId} />
        )}
        <div className="view-seg">
          <button
            type="button"
            className={cn(view === "iso" && "active")}
            onClick={() => setView("iso")}
          >
            <Icon name="map" size={12} /> Iso
          </button>
          <button
            type="button"
            className={cn(view === "cards" && "active")}
            onClick={() => setView("cards")}
          >
            <Icon name="grid" size={12} /> Cards
          </button>
        </div>
        <button type="button" className="add" onClick={() => setAddOpen(true)}>
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
