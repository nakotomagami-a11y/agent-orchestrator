// ProjectManageModal — read/write project metadata (name override, description).
// Roster management has moved to "Add agent" + the AgentManager Instance tab,
// so this modal no longer touches the agent list. Projects themselves come from
// the filesystem scan and aren't created here — the wizard handles that.

import { useState } from "react";
import { I } from "./Avatars";
import * as api from "./api";
import type { ProjectSummary, ProjectMeta } from "./types";

interface Props {
  projects: ProjectSummary[];
  currentProjectId: string | null;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onSwitchTo: (id: string) => void;
}

type Mode =
  | { kind: "list" }
  | { kind: "edit"; original: ProjectSummary };

interface FormState {
  name: string;
  description: string;
  memory: string;
}

export function ProjectManageModal({
  projects, currentProjectId, onClose, onChanged, onSwitchTo,
}: Props) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", description: "", memory: "" });

  async function startEdit(p: ProjectSummary) {
    const full = await api.fetchProject(p.id);
    if (!full) { alert("Project disappeared"); return; }
    setMode({ kind: "edit", original: p });
    setForm({
      name: full.meta.name,
      description: full.meta.description,
      memory: full.memory,
    });
  }

  async function saveForm() {
    if (mode.kind !== "edit") return;
    if (!form.name.trim()) { alert("Name is required"); return; }
    setBusy("save");
    try {
      const metaPatch: Partial<ProjectMeta> = {
        name: form.name,
        description: form.description,
      };
      await api.updateProjectMeta(mode.original.id, { meta: metaPatch, memory: form.memory });
      await onChanged();
      setMode({ kind: "list" });
    } catch (e) {
      alert("Save failed: " + String(e));
    } finally {
      setBusy(null);
    }
  }

  async function deleteIt(p: ProjectSummary) {
    if (!confirm(`Remove project metadata for "${p.name}"?\n\nThis deletes ~/.claude/projects/${p.id}/ (the project's roster + memory). The folder on disk under your projects root stays untouched — you can re-create metadata later.`)) return;
    setBusy(p.id);
    try {
      await api.deleteProject(p.id);
      await onChanged();
    } catch (e) {
      alert("Delete failed: " + String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="wizard-scrim" onClick={onClose}>
      <div className="wizard" onClick={e => e.stopPropagation()} style={{ gridTemplateRows: "auto 1fr auto" }}>
        <div className="wizard-head">
          <h2>
            {mode.kind === "list" && "Projects"}
            {mode.kind === "edit" && `Edit ${mode.original.name}`}
          </h2>
          {mode.kind === "list" && (
            <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)", marginLeft: 8 }}>
              {projects.length} project{projects.length === 1 ? "" : "s"} · scanned from your projects folder
            </span>
          )}
          <button className="x" style={{ marginLeft: "auto" }} onClick={onClose}>×</button>
        </div>

        <div className="wizard-body scroll">
          {mode.kind === "list" ? (
            <>
              <div className="mono" style={{
                fontSize: 11, color: "var(--txt-3)",
                padding: "8px 12px", marginBottom: 12,
                background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6,
              }}>
                Projects come from your projects folder on disk. To add a new project, create a folder there
                (or change the root via the project switcher). Roster management is in "Add agent" and "Manage agents".
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {projects.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 24, color: "var(--txt-3)", fontSize: 13 }}>
                    No projects found. Add folders to your projects root, or pick a different root.
                  </div>
                ) : projects.map(p => {
                  const isCurrent = p.id === currentProjectId;
                  return (
                    <div key={p.id} style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12, alignItems: "center",
                      padding: 14,
                      background: isCurrent ? "var(--acc-subtle)" : "var(--bg-1)",
                      border: "1px solid " + (isCurrent ? "var(--acc)" : "var(--line)"),
                      borderRadius: 8,
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                          <span className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{p.id}</span>
                          {isCurrent && <span className="status-pill done" style={{ fontSize: 9.5 }}>current</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--txt-2)", marginTop: 2 }}>
                          {p.description || <span style={{ color: "var(--txt-3)" }}>(no description)</span>}
                        </div>
                        <div className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 4 }}>
                          {p.instanceCount} instance{p.instanceCount === 1 ? "" : "s"}
                          {p.cwd && <> · cwd <code style={{ color: "var(--txt-2)" }}>{p.cwd}</code></>}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {!isCurrent && (
                          <button className="btn ghost" style={{ height: 26, padding: "0 10px", fontSize: 11.5 }}
                            onClick={() => onSwitchTo(p.id)}>Switch</button>
                        )}
                        <button className="btn ghost" style={{ height: 26, padding: "0 10px", fontSize: 11.5 }}
                          onClick={() => startEdit(p)}>Edit</button>
                        <button className="btn ghost" style={{ height: 26, padding: "0 8px", fontSize: 11.5, color: "var(--error)" }}
                          onClick={() => deleteIt(p)} disabled={busy === p.id}>
                          {busy === p.id ? "…" : <I.Trash />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--txt-2)", fontWeight: 500, display: "block", marginBottom: 4 }}>Name</label>
                <input className="input" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
                <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 4 }}>
                  Override the folder name for display. The folder id stays <code>{mode.kind === "edit" && mode.original.id}</code>.
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--txt-2)", fontWeight: 500, display: "block", marginBottom: 4 }}>Description</label>
                <input className="input" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="What this project is for" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--txt-2)", fontWeight: 500, display: "block", marginBottom: 4 }}>
                  Project memory <span style={{ color: "var(--txt-3)" }}>(injected into every summon in this project)</span>
                </label>
                <textarea className="input" value={form.memory}
                  onChange={e => setForm({ ...form, memory: e.target.value })}
                  rows={10}
                  style={{ fontFamily: "var(--mono)", resize: "vertical", minHeight: 160 }}
                  placeholder="Context every agent in this project should know." />
              </div>
            </div>
          )}
        </div>

        <div className="wizard-foot">
          {mode.kind === "list" ? (
            <>
              <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
                Metadata at <code>~/.claude/projects/&lt;id&gt;/project.md</code>
              </div>
              <div className="right">
                <button className="btn" onClick={onClose}>Close</button>
              </div>
            </>
          ) : (
            <>
              <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
                editing <code>~/.claude/projects/{mode.kind === "edit" && mode.original.id}/project.md</code>
              </div>
              <div className="right">
                <button className="btn ghost" onClick={() => setMode({ kind: "list" })}>Back</button>
                <button className="btn primary" onClick={saveForm} disabled={busy === "save" || !form.name.trim()}>
                  {busy === "save" ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
