import { useEffect, useMemo, useState } from "react";
import { I } from "./Avatars";
import * as api from "./api";
import type { TemplateEntry } from "./api";
import type { Agent } from "./types";

interface Props {
  onClose: () => void;
  onApplyToWizard: (entry: TemplateEntry) => void;
  onCreated: () => void;
  existingAgents: Agent[];
}

const ROLES = ["Frontend", "QA", "Backend"] as const;

export function TemplatesModal({ onClose, onApplyToWizard, onCreated, existingAgents }: Props) {
  const [templates, setTemplates] = useState<TemplateEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.fetchTemplates().then(setTemplates).catch(e => setError(String(e)));
  }, []);

  const existingIds = useMemo(() => new Set(existingAgents.map(a => a.id)), [existingAgents]);

  async function createOne(t: TemplateEntry) {
    setBusy(t.id);
    try {
      await api.saveAgent(t, "create");
      onCreated();
    } catch (e) {
      alert("Create failed: " + String(e));
    } finally {
      setBusy(null);
    }
  }

  async function createRole(role: string) {
    if (!templates) return;
    const toCreate = templates.filter(t => t.role === role && !existingIds.has(t.id));
    if (toCreate.length === 0) return;
    if (!confirm(`Create ${toCreate.length} ${role} agent${toCreate.length === 1 ? "" : "s"}?\n\n${toCreate.map(t => "• " + t.name).join("\n")}`)) return;
    setBusy("role-" + role);
    try {
      const result = await api.bulkCreateAgents(toCreate);
      if (result.errors.length) alert(`Created ${result.written.length}, ${result.errors.length} errors:\n${result.errors.map(e => `${e.id}: ${e.error}`).join("\n")}`);
      onCreated();
    } catch (e) {
      alert("Bulk failed: " + String(e));
    } finally {
      setBusy(null);
    }
  }

  async function createAll() {
    if (!templates) return;
    const toCreate = templates.filter(t => !existingIds.has(t.id));
    if (toCreate.length === 0) return;
    if (!confirm(`Create all ${toCreate.length} agents?`)) return;
    setBusy("all");
    try {
      const result = await api.bulkCreateAgents(toCreate);
      if (result.errors.length) alert(`Created ${result.written.length}, ${result.errors.length} errors`);
      onCreated();
    } catch (e) {
      alert("Bulk failed: " + String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="wizard-scrim" onClick={onClose}>
      <div
        className="wizard"
        onClick={e => e.stopPropagation()}
        style={{ gridTemplateRows: "auto 1fr auto" }}
      >
        <div className="wizard-head">
          <h2>Templates</h2>
          <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)", marginLeft: 8 }}>
            curated starting points · pick a variant to install, or "Use as starting point" to tweak in the wizard
          </span>
          <button className="x" style={{ marginLeft: "auto" }} onClick={onClose}>×</button>
        </div>

        <div className="wizard-body scroll">
          {error && <div style={{ color: "var(--error)", fontFamily: "var(--mono)", fontSize: 12 }}>{error}</div>}
          {templates === null && !error && <div style={{ color: "var(--txt-3)" }}>loading…</div>}
          {templates && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {ROLES.map(role => {
                const inRole = templates.filter(t => t.role === role);
                if (inRole.length === 0) return null;
                const allInstalled = inRole.every(t => existingIds.has(t.id));
                return (
                  <div key={role}>
                    <div style={{
                      display: "flex", alignItems: "baseline", gap: 12,
                      marginBottom: 10, paddingBottom: 6,
                      borderBottom: "1px solid var(--line)",
                    }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{role}</h3>
                      <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
                        {inRole.length} variants
                      </span>
                      <button
                        className="btn ghost"
                        style={{ marginLeft: "auto", height: 28, padding: "0 10px", fontSize: 12 }}
                        onClick={() => createRole(role)}
                        disabled={allInstalled || busy !== null}
                        title={allInstalled ? "All variants already exist" : `Create all ${role} variants in one shot`}>
                        {allInstalled ? "✓ all installed" : `Create all ${role}`}
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                      {inRole.map(t => {
                        const exists = existingIds.has(t.id);
                        return (
                          <div key={t.templateId} style={{
                            display: "grid", gridTemplateColumns: "1fr auto",
                            gap: 14, alignItems: "start",
                            padding: 14,
                            background: exists ? "var(--bg-2)" : "var(--bg-1)",
                            border: "1px solid " + (exists ? "var(--line-strong)" : "var(--line)"),
                            borderRadius: 8,
                            opacity: exists ? 0.65 : 1,
                          }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                                <span style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</span>
                                <span className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{t.id}.md</span>
                                {exists && <span className="status-pill done" style={{ fontSize: 9.5 }}><I.Check /> installed</span>}
                              </div>
                              <div style={{ fontSize: 12.5, color: "var(--txt-1)", marginBottom: 4, fontStyle: "italic" }}>
                                {t.philosophy}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--txt-2)", lineHeight: 1.45, marginBottom: 8 }}>
                                {t.reasoning}
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                                <span className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)" }}>
                                  {t.model}/{t.effort}
                                </span>
                                <span style={{ color: "var(--line-strong)" }}>·</span>
                                <span className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)" }}>
                                  pm: {t.pm}
                                </span>
                                <span style={{ color: "var(--line-strong)" }}>·</span>
                                <span className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)" }}>
                                  tools: {t.tools.join(", ")}
                                </span>
                                {t.skills.length > 0 && (
                                  <>
                                    <span style={{ color: "var(--line-strong)" }}>·</span>
                                    {t.skills.map(s => <span key={s} className="tag skill" style={{ fontSize: 10 }}>#{s}</span>)}
                                  </>
                                )}
                              </div>
                              <div className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 6 }}>
                                {t.body.length.toLocaleString()} char system prompt
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <button
                                className="btn primary"
                                style={{ height: 28, padding: "0 12px", fontSize: 12, whiteSpace: "nowrap" }}
                                onClick={() => createOne(t)}
                                disabled={exists || busy !== null}>
                                {busy === t.id ? "…" : exists ? "Installed" : <><I.Plus /> Create</>}
                              </button>
                              <button
                                className="btn ghost"
                                style={{ height: 26, padding: "0 10px", fontSize: 11.5, whiteSpace: "nowrap" }}
                                onClick={() => { onApplyToWizard(t); onClose(); }}
                                title="Pre-fill the wizard and tweak before saving">
                                Tweak first
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="wizard-foot">
          <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
            edit <code style={{ color: "var(--txt-1)" }}>shared/agent_templates.ts</code> to add or refine variants
          </div>
          <div className="right">
            <button className="btn ghost" onClick={onClose}>Close</button>
            <button
              className="btn primary"
              onClick={createAll}
              disabled={!templates || busy !== null || (templates?.every(t => existingIds.has(t.id)) ?? true)}>
              {busy === "all" ? "creating…" : "Create everything missing"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
