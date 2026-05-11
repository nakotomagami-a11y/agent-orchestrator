import { useEffect, useRef, useState } from "react";
import { Avatar, I, type AvatarStyle } from "./Avatars";
import { PROMPT_TEMPLATES, fmtDur, relTime, TOOLS } from "./helpers";
import * as api from "./api";
import type { Attachment } from "./api";
import type { Agent, AgentStatus, Run, OutputSegment, Project } from "./types";

function fmtBytes(n: number): string {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

interface HeaderProps {
  agent: Agent;
  avatarStyle: AvatarStyle;
  onAbort: () => void;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
  /** Tooltip for the trash button. Reflects what the action actually does
   * in the current context: "Remove from roster" (instance) vs "Delete agent
   * definition" (global). */
  deleteTitle?: string;
  onClose?: () => void;
}

export function AgentHeader({
  agent, avatarStyle, onAbort, onEdit, onClone, onDelete,
  deleteTitle = "Delete agent definition",
  onClose,
}: HeaderProps) {
  return (
    <div className="agent-header">
      <div className="av" style={{ width: 44, height: 44 }}>
        <Avatar agent={agent} style={avatarStyle} size={44} />
      </div>
      <div style={{ minWidth: 0 }}>
        <h1>
          {agent.name}
          <StatusPill status={agent.status} />
          <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)", fontWeight: 400, letterSpacing: 0 }}>
            ~/.claude/agents/{agent.id}.md
          </span>
        </h1>
        <div className="desc">{agent.desc}</div>
      </div>
      <div className="actions">
        {agent.status === "working" && (
          <button className="btn danger" onClick={onAbort}>
            <I.Stop /> Abort
          </button>
        )}
        <button className="btn ghost" onClick={onClone} title="Duplicate as new agent">
          <I.Copy /> Clone
        </button>
        <button className="btn ghost" onClick={onEdit} title="Edit this agent">
          <I.Wrench /> Edit
        </button>
        <button className="btn ghost" onClick={onDelete} title={deleteTitle} style={{ color: "var(--error)" }}>
          <I.Trash />
        </button>
        {onClose && (
          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              marginLeft: 6, background: "transparent", border: 0,
              color: "var(--txt-2)", width: 30, height: 30, borderRadius: "var(--r-md)",
              fontSize: 20, cursor: "pointer", lineHeight: 1,
            }}>×</button>
        )}
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: AgentStatus }) {
  return (
    <span className={"status-pill " + status}>
      <span className={"statusdot " + status}></span>
      {status}
    </span>
  );
}

export type TabKey = "summon" | "history" | "config" | "memory" | "prompt";

export function Tabs({ active, onChange, history }: {
  active: TabKey;
  onChange: (t: TabKey) => void;
  history: Run[];
}) {
  const tabs: Array<{ k: TabKey; label: string; count?: number }> = [
    { k: "summon", label: "Summon" },
    { k: "history", label: "History", count: history.length },
    { k: "config", label: "Config" },
    { k: "memory", label: "Memory" },
    { k: "prompt", label: "System Prompt" },
  ];
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button key={t.k} className={active === t.k ? "on" : ""} onClick={() => onChange(t.k)}>
          {t.label}
          {t.count != null && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

interface SummonPanelProps {
  agent: Agent;
  runs: Run[];
  selectedRunId: string | null;
  recentPrompts: string[];
  currentProject: Project | null;
  onSelectRun: (id: string | null) => void;
  onSummon: (opts: { model: string; effort: string; prompt: string; cwd: string }) => void;
  onAbortRun: (runId: string) => void;
  onCloseRun: (runId: string) => void;
}

const DEFAULT_CWD = "";

export function SummonPanel({ agent, runs, selectedRunId, recentPrompts, currentProject, onSelectRun, onSummon, onAbortRun, onCloseRun }: SummonPanelProps) {
  const [model, setModel] = useState(agent.model);
  const [effort, setEffort] = useState(agent.effort);
  const [cwd, setCwd] = useState(DEFAULT_CWD);
  const [prompt, setPrompt] = useState("");
  const [recentOpen, setRecentOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const run = runs.find(r => r.id === selectedRunId) ?? runs[0] ?? null;
  const anyRunning = runs.some(r => r.status === "running");

  useEffect(() => {
    setModel(agent.model);
    setEffort(agent.effort);
  }, [agent.id, agent.model, agent.effort]);

  // Use project-scoped uploads when a project is active; fall back to agent-scoped otherwise.
  const projectId = currentProject?.id;

  async function refreshAttachments() {
    const list = projectId
      ? await api.listProjectAttachments(projectId).catch(() => [])
      : await api.listAttachments(agent.id).catch(() => []);
    setAttachments(list);
  }

  useEffect(() => {
    refreshAttachments();
  }, [agent.id, projectId]);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    setUploading(u => u + list.length);
    try {
      for (const f of list) {
        try {
          if (projectId) await api.uploadProjectAttachment(projectId, f);
          else await api.uploadAttachment(agent.id, f);
        } catch (e) {
          alert(`Failed to upload ${f.name}: ${String(e)}`);
        }
      }
      await refreshAttachments();
    } finally {
      setUploading(0);
    }
  }

  async function removeAttachment(filename: string) {
    try {
      if (projectId) await api.deleteProjectAttachment(projectId, filename);
      else await api.deleteAttachment(agent.id, filename);
      await refreshAttachments();
    } catch (e) {
      alert("Remove failed: " + String(e));
    }
  }

  function buildPromptWithAttachments(): string {
    if (attachments.length === 0) return prompt;
    const list = attachments.map(a => `- ${a.path}`).join("\n");
    return `Files attached for this task (use the Read tool to view them):\n${list}\n\n---\n\n${prompt}`;
  }

  const handleSummon = () => onSummon({ model, effort, prompt: buildPromptWithAttachments(), cwd });
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (prompt.trim()) handleSummon();
    }
  };

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (!file) continue;
        // Browsers hand us "image.png" with the wrong name for clipboard images;
        // generate a timestamped name so multi-paste doesn't collide.
        if (!file.name || /^image\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
          const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const ext = (file.type.split("/")[1] || "png").toLowerCase();
          files.push(new File([file], `pasted-${ts}.${ext}`, { type: file.type }));
        } else {
          files.push(file);
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      uploadFiles(files);
    }
  }

  return (
    <div className="summon-grid">
      <div className="card">
        <div className="card-h">
          <span className="title">Summon</span>
          <span style={{ color: "var(--txt-3)" }}>·</span>
          <span>per-summon overrides</span>
          <div className="right"><span className="kbd">⌘↵</span></div>
        </div>
        <div className="field-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field">
            <label>Model</label>
            <select className="select" value={model} onChange={e => setModel(e.target.value)}>
              <option value="default">Agent default</option>
              <option value="haiku">Haiku 4.5</option>
              <option value="sonnet">Sonnet 4.6</option>
              <option value="opus">Opus 4.7</option>
            </select>
          </div>
          <div className="field">
            <label>Effort</label>
            <select className="select" value={effort} onChange={e => setEffort(e.target.value)}>
              <option value="default">Agent default</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="xhigh">xhigh</option>
              <option value="max">max</option>
            </select>
          </div>
        </div>

        <div style={{ padding: "0 14px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <I.Folder />
          <span className="mono" style={{ fontSize: 10, color: "var(--txt-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>cwd</span>
          <input
            className="input"
            style={{ flex: 1, height: 28, fontFamily: "var(--mono)", fontSize: 12 }}
            value={cwd}
            onChange={e => setCwd(e.target.value)}
            placeholder="~/Documents/Lab/agent-office"
            spellCheck={false}
          />
          {cwd !== DEFAULT_CWD && (
            <button className="btn ghost" style={{ height: 26, padding: "0 8px", fontSize: 11.5 }}
              onClick={() => setCwd(DEFAULT_CWD)}>reset</button>
          )}
        </div>

        <div className="prompt-area">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
            }}
            style={{
              border: "1px dashed " + (dragOver ? "var(--acc)" : "var(--line-strong)"),
              background: dragOver ? "var(--acc-subtle)" : "var(--bg-2)",
              borderRadius: "var(--r-md)",
              padding: attachments.length > 0 ? 10 : 14,
              display: "flex", flexDirection: "column", gap: 8,
              transition: "background 0.1s, border-color 0.1s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <I.Paperclip />
              <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--txt-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Attachments
              </span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)" }}>
                {attachments.length === 0
                  ? "drop files (images, PDFs, text) — agent reads via Read tool"
                  : `${attachments.length} attached`}
                {uploading > 0 && ` · uploading ${uploading}…`}
              </span>
              <button
                className="btn ghost"
                style={{ marginLeft: "auto", height: 26, padding: "0 10px", fontSize: 11.5 }}
                onClick={() => fileInputRef.current?.click()}>
                <I.Plus /> Add files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }}
              />
            </div>
            {attachments.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {attachments.map(a => (
                  <span key={a.filename} className="tag tool" style={{
                    fontFamily: "var(--mono)", fontSize: 11,
                    paddingRight: 4, gap: 6,
                  }} title={a.path}>
                    {a.filename}
                    <span style={{ color: "var(--txt-3)", fontSize: 10 }}>{fmtBytes(a.size)}</span>
                    <button
                      onClick={() => removeAttachment(a.filename)}
                      style={{
                        background: "transparent", border: 0, color: "var(--txt-3)",
                        cursor: "pointer", padding: 0, marginLeft: 2,
                        width: 14, height: 14, borderRadius: 99, display: "grid", placeItems: "center",
                      }}
                      title="Remove">
                      <I.X style={{ width: 10, height: 10 }} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="prompt-templates" style={{ position: "relative" }}>
            {PROMPT_TEMPLATES.map(t => (
              <button key={t.name} className="tag tool" onClick={() => setPrompt(t.body)}>
                {t.name}
              </button>
            ))}
            <button className="tag tool"
              style={{ marginLeft: "auto" }}
              title="Recent prompts"
              onClick={() => setRecentOpen(v => !v)}
              disabled={recentPrompts.length === 0}>
              <I.Sparkles /> recent {recentPrompts.length > 0 && <span style={{ color: "var(--txt-3)" }}>·{recentPrompts.length}</span>}
            </button>
            {recentOpen && recentPrompts.length > 0 && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 10,
                width: "min(420px, 90%)", maxHeight: 240, overflow: "auto",
                background: "var(--bg-2)", border: "1px solid var(--line-strong)",
                borderRadius: "var(--r-md)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }} className="scroll">
                {recentPrompts.map((p, i) => (
                  <button key={i}
                    onClick={() => { setPrompt(p); setRecentOpen(false); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "8px 12px", background: "transparent", border: 0,
                      borderBottom: "1px solid var(--line)",
                      color: "var(--txt-1)", fontSize: 12.5, fontFamily: "var(--mono)",
                      cursor: "pointer",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                    {p.split("\n")[0]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea className="prompt-input scroll" value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={"Tell " + agent.name + " what to do… (paste images directly with ⌘V / Ctrl+V)"} />
          <div className="summon-actions">
            <button className="btn primary" onClick={handleSummon} disabled={!prompt.trim()}>
              <I.Play /> Summon{anyRunning ? " another" : ""}
            </button>
            {run && (
              <div className="budget" style={{ marginLeft: "auto" }}>
                cost <b>${(run.cost || 0).toFixed(4)}</b>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card output">
        <div className="card-h">
          <span className="title">Runs</span>
          <span style={{ color: "var(--txt-3)" }}>·</span>
          <span>{runs.length === 0 ? "none" : runs.length === 1 ? "1 run" : `${runs.length} runs`}</span>
          <div className="right">
            <button className="btn ghost" style={{ height: 26, padding: "0 8px", fontSize: 11.5 }}
              onClick={() => run && navigator.clipboard.writeText(segmentsToText(run.segments))}
              disabled={!run || run.segments.length === 0}>
              <I.Copy /> Copy
            </button>
            {run && run.status === "running" && (
              <button className="btn ghost danger" style={{ height: 26, padding: "0 8px", fontSize: 11.5 }}
                onClick={() => onAbortRun(run.id)}>
                <I.Stop /> Abort
              </button>
            )}
          </div>
        </div>

        {runs.length > 0 && (
          <div className="run-tabs">
            {runs.map(r => {
              const isOn = r.id === (selectedRunId ?? runs[0].id);
              const stateClass = r.status === "running" ? "running" : r.status === "error" ? "error" : "";
              return (
                <div key={r.id}
                  className={"run-tab " + stateClass + (isOn ? " on" : "")}
                  onClick={() => onSelectRun(r.id)}
                  title={r.prompt}>
                  <span className={"statusdot " + (r.status === "running" ? "working" : r.status === "error" ? "error" : "done")}></span>
                  <span className="truncate">{r.prompt.split("\n")[0] || "(empty)"}</span>
                  <span className="elapsed">{r.elapsedStr ?? (r.durMs ? fmtDur(r.durMs) : "")}</span>
                  {r.status !== "running" && (
                    <span className="close" onClick={e => { e.stopPropagation(); onCloseRun(r.id); }}>×</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <OutputBody run={run} agent={agent} />

        <div className="output-foot">
          <span className="stat">tokens in <b>{run?.tokensIn?.toLocaleString() || "0"}</b></span>
          <span className="stat">out <b>{run?.tokensOut?.toLocaleString() || "0"}</b></span>
          <span className="stat">cost <b>${(run?.cost || 0).toFixed(4)}</b></span>
          <span className="stat">elapsed <b>{run?.elapsedStr || "0s"}</b></span>
          <div className="right">
            <span>model <b style={{ color: "var(--txt-1)" }}>{run?.model ?? model}</b></span>
            <span>·</span>
            <span>effort <b style={{ color: "var(--txt-1)" }}>{run?.effort ?? effort}</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function segmentsToText(segments: OutputSegment[]): string {
  return segments.map(s => s.kind === "text" ? (s.text ?? "") : `\n[tool: ${s.toolName}]\n`).join("");
}

function OutputBody({ run, agent }: { run: Run | null; agent: Agent }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(true);

  useEffect(() => {
    if (!stuck || !containerRef.current) return;
    const el = containerRef.current;
    el.scrollTop = el.scrollHeight;
  }, [run?.segments, run?.status, stuck]);

  function onScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setStuck(atBottom);
  }

  function jumpToBottom() {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setStuck(true);
  }

  if (!run) {
    return (
      <div ref={containerRef} className="output-body scroll">
        <div style={{ color: "var(--txt-3)", fontSize: 12, padding: "8px 0" }}>
          <div style={{ marginBottom: 8 }}>—</div>
          <div>No runs yet. Type a task and hit <span className="kbd">⌘↵</span> to summon {agent.name}.</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="output-body scroll" onScroll={onScroll} style={{ position: "relative" }}>
      <div className="turn user">
        <div className="who"><span className="badge">you</span> <span>{relTime(run.ts)}</span></div>
        <div>{run.prompt}</div>
      </div>
      <div className="turn">
        <div className="who"><span className="badge">{agent.name.toLowerCase()}</span> <span>{run.model} · {run.effort}</span></div>
        {run.segments.length === 0 && run.status !== "running" && (
          <span style={{ color: "var(--txt-3)" }}>(no output)</span>
        )}
        {run.segments.map((seg, i) => {
          if (seg.kind === "text") {
            const isLast = i === run.segments.length - 1;
            return (
              <span key={i}>{seg.text}{isLast && run.status === "running" && <span className="cursor"></span>}</span>
            );
          }
          // tool block
          const argSummary = formatToolInput(seg.toolInput);
          return (
            <div key={i} className="tool">
              <span className="ok">●</span>
              <span style={{ color: "var(--txt-1)", fontWeight: 600 }}>{seg.toolName}</span>
              {argSummary && <span style={{ color: "var(--txt-2)" }}>{argSummary}</span>}
            </div>
          );
        })}
        {run.segments.length === 0 && run.status === "running" && <span className="cursor"></span>}
      </div>
      {!stuck && run.status === "running" && (
        <button onClick={jumpToBottom}
          style={{
            position: "sticky", bottom: 8, marginLeft: "auto", display: "block",
            background: "var(--acc)", color: "var(--txt-on-acc, #000)",
            border: 0, borderRadius: 99, padding: "6px 12px",
            fontSize: 11, fontWeight: 600, fontFamily: "var(--sans)",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}>
          ↓ new output
        </button>
      )}
    </div>
  );
}

function formatToolInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const obj = input as Record<string, unknown>;
  // Pull out a useful one-line summary based on common tool input shapes
  const candidates = ["url", "file_path", "path", "command", "pattern", "query"];
  for (const k of candidates) {
    if (typeof obj[k] === "string") return String(obj[k]).slice(0, 120);
  }
  // Fallback: short JSON preview
  const json = JSON.stringify(obj);
  return json.length > 80 ? json.slice(0, 80) + "…" : json;
}

export function HistoryTab({ runs }: { runs: Run[] }) {
  if (!runs.length) {
    return <div style={{ color: "var(--txt-3)", fontSize: 13 }}>No runs yet for this agent.</div>;
  }
  const totalCost = runs.reduce((s, r) => s + r.cost, 0);
  const totalTok = runs.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Run history</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
          {runs.length} runs
          <span style={{ margin: "0 8px", color: "var(--line-strong)" }}>·</span>
          total ${totalCost.toFixed(4)}
          <span style={{ margin: "0 8px", color: "var(--line-strong)" }}>·</span>
          {totalTok.toLocaleString()} tokens
        </div>
      </div>
      <div className="timeline">
        {runs.map(r => (
          <div key={r.id} className="run">
            <div className="when">{relTime(r.ts)}</div>
            <div className="body">
              <div className="prompt">{r.prompt}</div>
              <div className="meta">
                <span className={"statusdot " + (r.status === "running" ? "working" : r.status === "error" ? "error" : "done")}></span>
                <span>{r.status}</span>
                <span>·</span>
                <span>{fmtDur(r.durMs ?? 0)}</span>
                <span>·</span>
                <span>{r.model}/{r.effort}</span>
                <span>·</span>
                <span>{(r.tokensIn + r.tokensOut).toLocaleString()} tok</span>
              </div>
            </div>
            <div className="cost">${r.cost.toFixed(4)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConfigTab({ agent }: { agent: Agent }) {
  const sections = [
    { label: "Identity", rows: [
      ["name", agent.name],
      ["id", agent.id],
      ["file", "~/.claude/agents/" + agent.id + ".md"],
    ]},
    { label: "Defaults", rows: [
      ["model", agent.model],
      ["effort", agent.effort],
      ["permission-mode", agent.pm === "auto" ? "auto-accept" : agent.pm],
      ["room", agent.room ?? "(auto from skills)"],
    ]},
  ];
  return (
    <div className="col" style={{ gap: 18 }}>
      {sections.map(s => (
        <div key={s.label} className="card">
          <div className="card-h"><span className="title">{s.label}</span></div>
          <div style={{ padding: "4px 0" }}>
            {s.rows.map(([k, v]) => (
              <div key={k} style={{
                display: "grid", gridTemplateColumns: "180px 1fr",
                padding: "8px 14px", fontSize: 13,
                borderBottom: "1px solid var(--line)",
              }}>
                <div style={{ color: "var(--txt-3)", fontFamily: "var(--mono)", fontSize: 11.5 }}>{k}</div>
                <div className="mono" style={{ fontSize: 12.5 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card">
        <div className="card-h">
          <span className="title">Skills</span>
          <span style={{ color: "var(--txt-3)" }}>tags this agent advertises</span>
        </div>
        <div style={{ padding: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {agent.skills.length === 0 && <span style={{ fontSize: 12, color: "var(--txt-3)" }}>none</span>}
          {agent.skills.map(s => <span key={s} className="tag skill">#{s}</span>)}
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <span className="title">Allowed Tools</span>
          <span style={{ color: "var(--txt-3)" }}>guardrails</span>
          <div className="right">
            <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>permission-mode: {agent.pm}</span>
          </div>
        </div>
        <div style={{ padding: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {agent.tools.map(t => <span key={t} className="tag tool"><I.Check style={{ color: "var(--done)" }} />{t}</span>)}
          {TOOLS.filter(t => !agent.tools.includes(t)).slice(0, 4).map(t => (
            <span key={t} className="tag" style={{ opacity: 0.5 }}><I.X style={{ color: "var(--txt-3)" }} />{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PromptTab({ agent, body }: { agent: Agent; body: string | null }) {
  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="card-h">
        <span className="title">System Prompt</span>
        <span style={{ color: "var(--txt-3)" }}>~/.claude/agents/{agent.id}.md</span>
        <div className="right">
          <button className="btn ghost" style={{ height: 26, padding: "0 8px", fontSize: 11.5 }}
            onClick={() => body && navigator.clipboard.writeText(body)}>
            <I.Copy /> Copy
          </button>
        </div>
      </div>
      <div className="output-body scroll" style={{ background: "var(--bg-1)" }}>
        <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-wrap", color: "var(--txt-1)" }}>
          {body ?? "loading…"}
        </pre>
      </div>
    </div>
  );
}
