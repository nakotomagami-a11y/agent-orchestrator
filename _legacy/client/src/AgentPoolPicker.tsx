// AgentPoolPicker — modal for the "Add agent" button. Lists global agents;
// clicking one adds a new instance to the current project's roster.
// Multiple instances of the same agent are allowed — that's the whole point.

import { useState } from "react";
import { I } from "./Avatars";
import * as api from "./api";
import type { Agent, Project } from "./types";

interface Props {
  project: Project;
  agents: Agent[];
  onClose: () => void;
  onAdded: () => Promise<void> | void;
  onNewAgent: () => void;            // open Templates so the user can create a new agent
}

export function AgentPoolPicker({ project, agents, onClose, onAdded, onNewAgent }: Props) {
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = agents.filter(a =>
    !filter.trim() ||
    a.name.toLowerCase().includes(filter.toLowerCase()) ||
    a.id.toLowerCase().includes(filter.toLowerCase()) ||
    a.skills.some(s => s.toLowerCase().includes(filter.toLowerCase())),
  );

  function instanceCountFor(agentId: string): number {
    return project.meta.roster.filter(i => i.agentId === agentId).length;
  }

  async function add(agentId: string) {
    setBusy(agentId); setError(null);
    try {
      await api.addInstance(project.id, agentId);
      await onAdded();
    } catch (e) { setError(String(e)); }
    finally { setBusy(null); }
  }

  return (
    <div className="wizard-scrim" onClick={onClose}>
      <div className="wizard" style={{ width: "min(720px, 100%)", gridTemplateRows: "auto 1fr auto" }}
        onClick={e => e.stopPropagation()}>
        <div className="wizard-head">
          <h2>Add agent to {project.meta.name}</h2>
          <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)", marginLeft: 10 }}>
            click to add one instance · click again to add another
          </span>
          <button className="x" style={{ marginLeft: "auto" }} onClick={onClose}>×</button>
        </div>

        <div className="wizard-body scroll">
          {agents.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 14, color: "var(--txt-2)", marginBottom: 14 }}>
                No agent definitions found in <code>~/.claude/agents/</code>.
              </div>
              <button className="btn primary" onClick={() => { onClose(); onNewAgent(); }}>
                <I.Plus /> Browse templates
              </button>
            </div>
          ) : (
            <>
              <input
                className="input"
                placeholder="Filter by name, id, or skill…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                autoFocus
                style={{ marginBottom: 12 }}
              />
              {error && (
                <div style={{
                  color: "var(--error)", fontSize: 12, fontFamily: "var(--mono)",
                  padding: "8px 12px", background: "color-mix(in oklch, var(--error) 12%, transparent)",
                  borderRadius: 6, marginBottom: 10,
                }}>{error}</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {filtered.map(a => {
                  const n = instanceCountFor(a.id);
                  const isBusy = busy === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => add(a.id)}
                      disabled={!!busy}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 10, alignItems: "center",
                        padding: "10px 14px",
                        background: isBusy ? "var(--bg-3)" : "var(--bg-1)",
                        border: "1px solid var(--line)",
                        borderRadius: 6,
                        cursor: busy ? "wait" : "pointer", textAlign: "left",
                        fontFamily: "inherit",
                        opacity: busy && !isBusy ? 0.55 : 1,
                      }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</span>
                          <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>{a.id}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--txt-2)", marginTop: 3, lineHeight: 1.35 }}>
                          {a.desc || <i style={{ color: "var(--txt-3)" }}>no description</i>}
                        </div>
                        <div className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 4 }}>
                          {a.model} · {a.effort}
                          {n > 0 && <> · already in roster: {n}</>}
                        </div>
                      </div>
                      <span style={{
                        padding: "5px 10px", borderRadius: 4,
                        background: isBusy ? "var(--bg-2)" : "var(--acc)",
                        color: "var(--acc-text)",
                        fontSize: 11.5, fontWeight: 600,
                      }}>
                        {isBusy ? "adding…" : <><I.Plus style={{ marginRight: 4 }} /> Add</>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="wizard-foot">
          <button className="btn ghost" onClick={() => { onClose(); onNewAgent(); }}>
            <I.Sparkles /> Browse templates · new agent
          </button>
          <div className="right">
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
