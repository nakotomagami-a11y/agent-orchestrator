// RosterModal — a single, focused view of the agents running in this project.
// Each row is one AgentInstance from the project's roster. Removing a row removes
// it from this project ONLY; the underlying agent definition in ~/.claude/agents/
// stays put and remains available to other projects.
//
// Per-instance overrides (label, model, effort, permission, room) edit inline.
// There is intentionally no path here to delete an agent definition — that lives
// on the per-agent header (Edit/Clone/Delete) on the floor plan, where the
// blast radius is unambiguous.

import { useState } from "react";
import { I } from "./Avatars";
import * as api from "./api";
import type { Agent, AgentInstance, Project } from "./types";

interface Props {
  open: boolean;
  agents: Agent[];                 // global pool, for resolving labels/skills/missing-agent display
  currentProject: Project;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onAddAgent: () => void;          // opens AgentPoolPicker
}

const MODEL_OPTIONS = ["", "default", "haiku", "sonnet", "opus"];
const EFFORT_OPTIONS = ["", "default", "low", "medium", "high", "xhigh", "max"];
const PM_OPTIONS = ["", "default", "acceptEdits", "auto", "bypassPermissions", "dontAsk", "plan"];
const ROOM_OPTIONS = ["", "Research", "Build", "QA", "Ops"];

export function RosterModal({ open, agents, currentProject, onClose, onChanged, onAddAgent }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!open) return null;

  const agentById = Object.fromEntries(agents.map(a => [a.id, a]));
  const roster = currentProject.meta.roster;

  return (
    <div className="wizard-scrim" onClick={onClose}>
      <div className="wizard" style={{ width: "min(720px, 100%)", gridTemplateRows: "auto 1fr auto" }}
        onClick={e => e.stopPropagation()}>
        <div className="wizard-head">
          <h2>Roster · {currentProject.meta.name}</h2>
          <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)", marginLeft: 10 }}>
            {roster.length} {roster.length === 1 ? "agent" : "agents"} in this project
          </span>
          <button className="x" style={{ marginLeft: "auto" }} onClick={onClose}>×</button>
        </div>

        <div className="wizard-body scroll">
          {roster.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--txt-2)" }}>
              <div style={{ fontSize: 14, marginBottom: 14 }}>
                This project doesn't have any agents yet.
              </div>
              <button className="btn primary" onClick={onAddAgent}>
                <I.Plus /> Add agent
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {roster.map(inst => (
                <InstanceRow
                  key={inst.instanceId}
                  instance={inst}
                  baseAgent={agentById[inst.agentId]}
                  projectId={currentProject.id}
                  expanded={expanded === inst.instanceId}
                  onToggleExpand={() => setExpanded(e => e === inst.instanceId ? null : inst.instanceId)}
                  onChanged={onChanged}
                />
              ))}
            </div>
          )}
        </div>

        <div className="wizard-foot">
          <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
            Removing an agent from this list only removes it from <b>{currentProject.meta.name}</b>.
            The agent itself stays in your pool.
          </span>
          <div className="right">
            <button className="btn ghost" onClick={onAddAgent}>
              <I.Plus /> Add agent
            </button>
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstanceRow({
  instance, baseAgent, projectId, expanded, onToggleExpand, onChanged,
}: {
  instance: AgentInstance;
  baseAgent: Agent | undefined;
  projectId: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState(instance.label ?? "");
  const [model, setModel] = useState(instance.model ?? "");
  const [effort, setEffort] = useState(instance.effort ?? "");
  const [permissionMode, setPermissionMode] = useState(instance.permissionMode ?? "");
  const [room, setRoom] = useState(instance.room ?? "");

  const displayName = instance.label ?? baseAgent?.name ?? instance.agentId;
  const missingAgent = !baseAgent;

  const overrides: string[] = [];
  if (instance.model) overrides.push(`model: ${instance.model}`);
  if (instance.effort) overrides.push(`effort: ${instance.effort}`);
  if (instance.permissionMode) overrides.push(`pm: ${instance.permissionMode}`);
  if (instance.room) overrides.push(`room: ${instance.room}`);

  async function saveOverrides() {
    setBusy(true); setError(null);
    try {
      await api.patchInstance(projectId, instance.instanceId, {
        label, model, effort, permissionMode, room,
      });
      await onChanged();
      onToggleExpand();  // collapse after save
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm(
      `Remove "${displayName}" from this project's roster?\n\n` +
      `This only removes the instance from this project. ` +
      `The agent definition (${instance.agentId}) stays in your agents pool and is still available to other projects.`,
    )) return;
    setBusy(true); setError(null);
    try {
      await api.removeInstance(projectId, instance.instanceId);
      await onChanged();
    } catch (e) { setError(String(e)); setBusy(false); }
  }

  return (
    <div style={{
      border: "1px solid var(--line)",
      borderRadius: 8,
      background: missingAgent ? "color-mix(in oklch, var(--error) 6%, var(--bg-1))" : "var(--bg-1)",
    }}>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr auto", gap: 12,
        padding: "12px 14px", alignItems: "center",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{displayName}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
              {instance.agentId}{missingAgent && <span style={{ color: "var(--error)" }}> · not in agents pool</span>}
            </span>
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 4 }}>
            id: {instance.instanceId}
            {overrides.length > 0 && <> · {overrides.join(" · ")}</>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button className="btn ghost" onClick={onToggleExpand} title="Edit overrides">
            <I.Wrench /> {expanded ? "Cancel" : "Edit"}
          </button>
          <button
            className="btn ghost"
            onClick={remove}
            disabled={busy}
            title="Remove from this project's roster (does not delete the agent)"
            style={{ color: "var(--error)" }}>
            <I.Trash />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Label" hint="Display name on the floor plan. Defaults to the agent name.">
            <input className="input" value={label} onChange={e => setLabel(e.target.value)}
              placeholder={baseAgent?.name ?? instance.agentId} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Model">
              <Select value={model} onChange={setModel} options={MODEL_OPTIONS} placeholder="(agent default)" />
            </Field>
            <Field label="Effort">
              <Select value={effort} onChange={setEffort} options={EFFORT_OPTIONS} placeholder="(agent default)" />
            </Field>
            <Field label="Permission mode">
              <Select value={permissionMode} onChange={setPermissionMode} options={PM_OPTIONS} placeholder="(agent default)" />
            </Field>
            <Field label="Room">
              <Select value={room} onChange={setRoom} options={ROOM_OPTIONS} placeholder="(auto by skills)" />
            </Field>
          </div>
          {error && <div style={{ color: "var(--error)", fontSize: 12, fontFamily: "var(--mono)" }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn ghost" onClick={onToggleExpand} disabled={busy}>Cancel</button>
            <button className="btn primary" onClick={saveOverrides} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 11, color: "var(--txt-2)",
        fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em",
      }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Select({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <select className="input" value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%" }}>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt === "" ? (placeholder ?? "(none)") : opt}</option>
      ))}
    </select>
  );
}
