"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgent, useAgentBody, useWriteAgent, useDeleteAgent } from "@/modules/agents/hooks/use-agents";
import { fromApi, toBody, type AgentFormValues } from "@/modules/agents/utils/agent-form";
import { useAgentForm } from "@/modules/agents/hooks/use-agent-form";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";
import { MODEL_OPTS, EFFORT_OPTS } from "@agent-office/shared";
import {
  AoIdentity, AoCpu, AoSparkle, AoWrench, AoCode, AoEye,
  AoBold, AoItalic, AoHeading, AoLink, AoCheck, AoReset, AoTrash, AoClose, AoPlus,
  AoFolder, AoSearch, AoTerminal, AoGlobe, AoList, AoPen,
} from "@/modules/summon/components/ao-icons";
import { UnitPicker } from "@/components/ui/unit-picker";


const TOOL_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Read: AoFolder, Write: AoPen, Edit: AoPen, Bash: AoTerminal,
  WebFetch: AoGlobe, WebSearch: AoSearch, Agent: AoList,
};

function iconForTool(t: string) {
  const Ic = TOOL_ICONS[t] ?? AoWrench;
  return <Ic size={12} />;
}

export function SettingsTab({
  agentId,
  onAfterSave,
  onAfterDelete,
}: {
  agentId: string;
  onAfterSave: () => void;
  onAfterDelete: () => void;
}) {
  const agentQ = useAgent(agentId);
  const bodyQ = useAgentBody(agentId);
  const qc = useQueryClient();
  const writeMut = useWriteAgent();
  const deleteMut = useDeleteAgent();

  const [formKey, setFormKey] = useState(0);

  if (agentQ.isLoading || bodyQ.isLoading) {
    return (
      <div className="ao-tab-pane">
        <Skeleton width="100%" height={240} />
      </div>
    );
  }
  if (!agentQ.data) {
    return (
      <div className="ao-tab-pane" style={{ color: "var(--ao-fg-2)", padding: 18 }}>
        Failed to load agent settings.
      </div>
    );
  }

  const initialValues = fromApi(agentQ.data, bodyQ.data ?? "");

  return (
    <SettingsForm
      key={formKey}
      initial={initialValues}
      agentId={agentId}
      onSave={async (values) => {
        const body = toBody(values);
        await writeMut.mutateAsync(body);
        qc.invalidateQueries({ queryKey: queryKeys.agents.all });
        qc.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId) });
        qc.invalidateQueries({ queryKey: queryKeys.agents.body(agentId) });
        setFormKey((k) => k + 1);
        onAfterSave();
      }}
      onDelete={async () => {
        if (!window.confirm(`Delete agent "${agentId}"? This cannot be undone.`)) return;
        await deleteMut.mutateAsync(agentId);
        qc.invalidateQueries({ queryKey: queryKeys.agents.all });
        onAfterDelete();
      }}
      saving={writeMut.isPending}
      deleting={deleteMut.isPending}
    />
  );
}

function SettingsForm({
  initial,
  agentId,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  initial: AgentFormValues;
  agentId: string;
  onSave: (values: AgentFormValues) => Promise<void>;
  onDelete: () => Promise<void>;
  saving: boolean;
  deleting: boolean;
}) {
  const {
    v, setV,
    errors,
    serverError,
    view, setView,
    skillInput, setSkillInput,
    toolInput, setToolInput,
    dirty,
    skills,
    tools,
    set,
    setSkills,
    setTools,
    addSkill,
    addTool,
    handleSave,
    handleDiscard,
  } = useAgentForm(initial, onSave);

  const promptLines = v.body.split("\n");

  const AVAIL_TOOLS = ["Read", "Write", "Edit", "Bash", "WebFetch", "WebSearch", "Agent"];

  return (
    <div className="ao-tab-pane">
      {/* ── Identity section ── */}
      <div className="ao-settings-section">
        <div className="ao-section-title">
          <span className="ao-marker" />
          <h3>Identity</h3>
          <span className="ao-sub">how this agent is named and described</span>
        </div>
        <div className="ao-card">
          <div className="ao-card-header">
            <div className="ao-icon"><AoIdentity size={15} /></div>
            <div className="ao-title">Basic info</div>
          </div>
          <div className="ao-card-body">
            <div className="ao-grid-2">
              <div className="ao-field">
                <label className="ao-label">Name</label>
                <div className="ao-input">
                  <input value={v.name} onChange={set("name")} placeholder="My Agent" />
                </div>
              </div>
              <div className="ao-field">
                <label className="ao-label">ID (slug) <span className="ao-req">·</span></label>
                <div className="ao-input ao-mono">
                  <span className="ao-prefix">~/.claude/agents/</span>
                  <input value={v.id} disabled title="ID cannot be changed after creation" />
                  <span className="ao-prefix">.md</span>
                </div>
              </div>
            </div>
            <div className="ao-field" style={{ marginTop: 12 }}>
              <label className="ao-label">Description</label>
              <div className="ao-input">
                <input value={v.desc} onChange={set("desc")} placeholder="One-sentence description…" />
              </div>
              <div className="ao-help">{v.desc.length} / 240 chars</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Runtime section ── */}
      <div className="ao-settings-section">
        <div className="ao-section-title">
          <span className="ao-marker" />
          <h3>Runtime</h3>
          <span className="ao-sub">model and execution policy</span>
        </div>
        <div className="ao-card">
          <div className="ao-card-header">
            <div className="ao-icon"><AoCpu size={15} /></div>
            <div className="ao-title">Execution</div>
          </div>
          <div className="ao-card-body">
            <div className="ao-grid-2">
              <div className="ao-field">
                <label className="ao-label">Model</label>
                <div className="ao-input">
                  <select className="ao-select" value={v.model} onChange={set("model")}>
                    {MODEL_OPTS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="ao-field">
                <label className="ao-label">Effort</label>
                <div className="ao-input">
                  <select className="ao-select" value={v.effort} onChange={set("effort")}>
                    {EFFORT_OPTS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="ao-field" style={{ marginTop: 14 }}>
              <label className="ao-label">Permission mode</label>
              <div className="ao-permission-mode">
                <button type="button" className={v.pm === "auto" ? "ao-active" : ""} onClick={() => setV((p) => ({ ...p, pm: "auto" }))}>
                  <span className="ao-t">Auto</span>
                  <span className="ao-d">trust all tool calls</span>
                </button>
                <button type="button" className={v.pm === "ask" ? "ao-active" : ""} onClick={() => setV((p) => ({ ...p, pm: "ask" }))}>
                  <span className="ao-t">Ask</span>
                  <span className="ao-d">prompt on destructive ops</span>
                </button>
                <button type="button" className={v.pm === "plan" ? "ao-active" : ""} onClick={() => setV((p) => ({ ...p, pm: "plan" }))}>
                  <span className="ao-t">Plan</span>
                  <span className="ao-d">read-only mode</span>
                </button>
              </div>
            </div>

            <div className="ao-field" style={{ marginTop: 14 }}>
              <label className="ao-label">Room <span className="ao-muted" style={{ textTransform: "none", letterSpacing: 0, fontFamily: "var(--ao-font-sans)", fontWeight: 400 }}>· optional</span></label>
              <div className="ao-input">
                <input value={v.room} onChange={set("room")} placeholder="e.g. Build" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Capabilities section ── */}
      <div className="ao-settings-section">
        <div className="ao-section-title">
          <span className="ao-marker" />
          <h3>Capabilities</h3>
          <span className="ao-sub">{skills.length} skills · {tools.length} tools</span>
        </div>
        <div className="ao-card">
          <div className="ao-card-header">
            <div className="ao-icon"><AoWrench size={15} /></div>
            <div className="ao-title">Skills &amp; tools</div>
          </div>
          <div className="ao-card-body">
            <div className="ao-field">
              <label className="ao-label"><AoSparkle size={11} /> Skills</label>
              <div className="ao-chip-picker">
                {skills.map((s) => (
                  <span key={s} className="ao-chip">
                    {s}
                    <button type="button" className="ao-x" onClick={() => setSkills(skills.filter((x) => x !== s))} aria-label="remove">
                      <AoClose size={10} />
                    </button>
                  </span>
                ))}
                <input
                  className="ao-add-chip"
                  placeholder={skills.length === 0 ? "add a skill — frontend-design, research, …" : "+ add skill"}
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(); } }}
                />
              </div>
              <div className="ao-help">enter to add · comma-separated</div>
            </div>

            <div className="ao-field" style={{ marginTop: 14 }}>
              <label className="ao-label"><AoWrench size={11} /> Tools allowed</label>
              <div className="ao-chip-picker">
                {tools.map((t) => (
                  <span key={t} className="ao-chip ao-tool">
                    <span className="ao-icon">{iconForTool(t)}</span>
                    {t}
                    <button type="button" className="ao-x" onClick={() => setTools(tools.filter((x) => x !== t))} aria-label="remove">
                      <AoClose size={10} />
                    </button>
                  </span>
                ))}
                <input
                  className="ao-add-chip"
                  placeholder="+ add tool"
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTool(); } }}
                />
              </div>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span className="ao-muted ao-mono ao-tiny">suggested:</span>
                {AVAIL_TOOLS.filter((t) => !tools.includes(t)).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="ao-tool-chip"
                    style={{ cursor: "pointer" }}
                    onClick={() => setTools([...tools, t])}
                  >
                    <span className="ao-icon">{iconForTool(t)}</span>
                    {t}
                    <AoPlus size={10} style={{ color: "var(--ao-fg-3)" }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Appearance section ── */}
      <div className="ao-settings-section">
        <div className="ao-section-title">
          <span className="ao-marker" />
          <h3>Appearance</h3>
          <span className="ao-sub">avatar shown in the office floor and sidebar</span>
        </div>
        <div className="ao-card">
          <div className="ao-card-body">
            <div className="ao-field">
              <label className="ao-label">Avatar</label>
              <UnitPicker
                value={v.unit}
                onChange={(val) => setV((p) => ({ ...p, unit: val }))}
                agentName={v.name}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── System prompt section ── */}
      <div className="ao-settings-section">
        <div className="ao-section-title">
          <span className="ao-marker" />
          <h3>System prompt</h3>
          <span className="ao-sub">
            markdown body · {v.body.length.toLocaleString()} chars · ~{Math.round(v.body.length / 4)} tokens
          </span>
        </div>

        <div className="ao-markdown-editor">
          <div className="ao-tabs">
            <button type="button" className={view === "write" ? "ao-active" : ""} onClick={() => setView("write")}>
              <AoCode size={12} /> Write
            </button>
            <button type="button" className={view === "preview" ? "ao-active" : ""} onClick={() => setView("preview")}>
              <AoEye size={12} /> Preview
            </button>
            <div className="ao-toolbar">
              <button type="button" aria-label="heading" onClick={() => setV((p) => ({ ...p, body: p.body + "\n## " }))}><AoHeading size={13} /></button>
              <button type="button" aria-label="bold" onClick={() => setV((p) => ({ ...p, body: p.body + "****" }))}><AoBold size={13} /></button>
              <button type="button" aria-label="italic" onClick={() => setV((p) => ({ ...p, body: p.body + "**" }))}><AoItalic size={13} /></button>
              <button type="button" aria-label="link" onClick={() => setV((p) => ({ ...p, body: p.body + "[](url)" }))}><AoLink size={13} /></button>
              <button type="button" aria-label="code" onClick={() => setV((p) => ({ ...p, body: p.body + "``" }))}><AoCode size={13} /></button>
            </div>
          </div>

          {view === "write" ? (
            <div className="ao-editor">
              <div className="ao-gutter">
                {promptLines.map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <textarea
                className="ao-code"
                value={v.body}
                onChange={(e) => setV((p) => ({ ...p, body: e.target.value }))}
                spellCheck={false}
                style={{ resize: "none", height: Math.max(200, promptLines.length * 20) }}
              />
            </div>
          ) : (
            <div className="ao-preview">
              <MarkdownPreview md={v.body} />
            </div>
          )}
        </div>
      </div>

      {/* Error display */}
      {(errors.length > 0 || serverError) && (
        <div style={{ background: "var(--ao-bad-soft)", border: "1px solid var(--ao-bad)", borderRadius: "var(--ao-radius-md)", padding: "10px 14px", color: "var(--ao-bad)", fontSize: 13, marginBottom: 14 }}>
          {serverError ?? errors.join(" · ")}
        </div>
      )}

      {/* Save bar */}
      <div className="ao-save-bar">
        {dirty ? (
          <span className="ao-dirty"><span className="ao-led" /> Unsaved changes</span>
        ) : (
          <span style={{ color: "var(--ao-fg-3)", fontSize: 12, fontFamily: "var(--ao-font-mono)" }}>No changes</span>
        )}
        <div className="ao-right">
          <button type="button" className="ao-btn ao-ghost" onClick={handleDiscard} disabled={!dirty}>
            Discard
          </button>
          <button
            type="button"
            className="ao-btn"
            style={{ color: "var(--ao-bad)", borderColor: "var(--ao-bad-soft)" }}
            onClick={onDelete}
            disabled={deleting}
          >
            <AoTrash size={12} /> Delete
          </button>
          <button type="button" className="ao-btn ao-ghost">
            <AoReset size={12} /> Revert
          </button>
          <button type="button" className="ao-btn ao-primary" onClick={handleSave} disabled={saving || !dirty}>
            <AoCheck size={13} /> Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function MarkdownPreview({ md }: { md: string }) {
  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const out: React.ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    out.push(<p key={out.length} dangerouslySetInnerHTML={{ __html: inline(para.join(" ")) }} />);
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    out.push(<ul key={out.length}>{list.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inline(it) }} />)}</ul>);
    list = [];
  };

  for (const raw of md.split("\n")) {
    const ln = raw.trimEnd();
    if (/^# /.test(ln)) { flushList(); flushPara(); out.push(<h1 key={out.length} dangerouslySetInnerHTML={{ __html: inline(ln.slice(2)) }} />); continue; }
    if (/^## /.test(ln)) { flushList(); flushPara(); out.push(<h2 key={out.length} dangerouslySetInnerHTML={{ __html: inline(ln.slice(3)) }} />); continue; }
    if (/^### /.test(ln)) { flushList(); flushPara(); out.push(<h2 key={out.length} dangerouslySetInnerHTML={{ __html: inline(ln.slice(4)) }} />); continue; }
    if (/^[-*] /.test(ln)) { flushPara(); list.push(ln.slice(2)); continue; }
    if (!ln.trim()) { flushPara(); flushList(); continue; }
    flushList(); para.push(ln);
  }
  flushPara(); flushList();
  return <>{out}</>;
}
