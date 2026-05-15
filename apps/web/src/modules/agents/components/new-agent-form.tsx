"use client";

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { unitForAgent } from "@/components/ui/unit-sprite.utils";
import { Icon } from "@/components/ui/icon";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import {
  EMPTY_FORM,
  type AgentFormValues,
  type FormError,
  slugifyId,
  toBody,
  validateForm,
} from "../utils/agent-form";
import { useCreateAgent } from "../hooks/use-agents";
import { useInstalledSkills } from "@/modules/skills/hooks/use-skills";

const TOOL_SUGGESTIONS = [
  { id: "Read",      desc: "Read files" },
  { id: "Write",     desc: "Write files" },
  { id: "Edit",      desc: "Edit files" },
  { id: "Bash",      desc: "Run shell" },
  { id: "Grep",      desc: "Search code" },
  { id: "WebFetch",  desc: "Fetch URLs" },
  { id: "TodoWrite", desc: "Task list" },
  { id: "Task",      desc: "Spawn agents" },
];

const MODELS = [
  { id: "haiku",  name: "haiku",  full: "claude-haiku-4-5",  badge: "fast",  price: "$0.25/Mt", desc: "Light tasks, snappy. Good for orchestration." },
  { id: "sonnet", name: "sonnet", full: "claude-sonnet-4-6", badge: "smart", price: "$3.00/Mt", desc: "Balanced — the default for most agents." },
  { id: "opus",   name: "opus",   full: "claude-opus-4-7",   badge: "deep",  price: "$15.00/Mt", desc: "Hardest reasoning. Slow. Use sparingly." },
] as const;

const EFFORTS = [
  { id: "low",    bars: 1 },
  { id: "medium", bars: 2 },
  { id: "high",   bars: 3 },
  { id: "xhigh",  bars: 4 },
] as const;

type Model = typeof MODELS[number]["id"];
type Effort = typeof EFFORTS[number]["id"];
type Perm = "auto" | "ask" | "deny";

const DESC_MAX = 240;

function parseCsv(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}
function toCsv(arr: string[]): string {
  return arr.join(", ");
}
function countDirty(values: AgentFormValues): number {
  return (Object.keys(EMPTY_FORM) as (keyof AgentFormValues)[]).filter(
    (k) => values[k] !== EMPTY_FORM[k]
  ).length;
}

/* ── Markdown editor ─────────────────────────────────────────── */

function inlineMd(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderPreview(md: string): string {
  const out: string[] = [];
  const lines = md.split("\n");
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inlineMd(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list.length) { out.push(`<ul>${list.map((it) => `<li>${inlineMd(it)}</li>`).join("")}</ul>`); list = []; } };
  for (const raw of lines) {
    const ln = raw.trimEnd();
    if (/^#\s+/.test(ln)) { flushList(); flushPara(); out.push(`<h1>${inlineMd(ln.replace(/^#\s+/, ""))}</h1>`); continue; }
    if (/^##\s+/.test(ln)) { flushList(); flushPara(); out.push(`<h2>${inlineMd(ln.replace(/^##\s+/, ""))}</h2>`); continue; }
    if (/^###\s+/.test(ln)) { flushList(); flushPara(); out.push(`<h3>${inlineMd(ln.replace(/^###\s+/, ""))}</h3>`); continue; }
    if (/^[-*]\s+/.test(ln)) { flushPara(); list.push(ln.replace(/^[-*]\s+/, "")); continue; }
    if (!ln.trim()) { flushPara(); flushList(); continue; }
    flushList(); para.push(ln);
  }
  flushPara(); flushList();
  return out.join("");
}

function MarkdownEditor({ value, onChange, hasError }: { value: string; onChange: (v: string) => void; hasError?: boolean }) {
  const [view, setView] = useState<"write" | "preview">("write");
  const lines = value.split("\n");

  return (
    <div className={`markdown-editor${hasError ? " error" : ""}`}>
      <div className="tabs">
        <button type="button" className={view === "write" ? "active" : ""} onClick={() => setView("write")}>
          <Icon name="pen" size={12} /> Write
        </button>
        <button type="button" className={view === "preview" ? "active" : ""} onClick={() => setView("preview")}>
          <Icon name="play" size={12} /> Preview
        </button>
        <div className="toolbar">
          <button type="button" aria-label="heading" title="Heading"><Icon name="pen" size={13} /></button>
          <button type="button" aria-label="code" title="Code"><Icon name="terminal" size={13} /></button>
          <button type="button" aria-label="list" title="List"><Icon name="list" size={13} /></button>
        </div>
      </div>
      {view === "write" ? (
        <div className="editor">
          <div className="gutter">
            {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
          </div>
          <textarea
            className="code-area"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write your system prompt here…"
            spellCheck={false}
          />
        </div>
      ) : (
        <div
          className="preview"
          dangerouslySetInnerHTML={{ __html: renderPreview(value) || "<p style='color:var(--txt-4)'>Nothing to preview yet.</p>" }}
        />
      )}
    </div>
  );
}

/* ── Section card ─────────────────────────────────────────────── */

function SectionCard({ n, title, sub, complete, children }: {
  n: string; title: string; sub: string; complete: boolean; children: React.ReactNode;
}) {
  return (
    <section className="na-section">
      <div className="na-section-head">
        <div className="num">{n}</div>
        <div className="titles">
          <h3>{title}</h3>
          <div className="sub">{sub}</div>
        </div>
        <div className={`check${complete ? "" : " empty"}`}>
          {complete
            ? <Icon name="check" size={11} />
            : <span className="w-1 h-1 rounded-[2px] bg-current block" />}
        </div>
      </div>
      <div className="na-section-body">{children}</div>
    </section>
  );
}

/* ── Chip picker ──────────────────────────────────────────────── */

function ChipPicker({ chips, suggestions, onAdd, onRemove, placeholder }: {
  chips: string[];
  suggestions: Array<{ id: string; desc?: string }>;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (val: string) => {
    const t = val.trim();
    if (t && !chips.includes(t)) onAdd(t);
    setInput("");
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) { e.preventDefault(); add(input); }
    if (e.key === "Backspace" && !input && chips.length > 0) onRemove(chips[chips.length - 1]!);
  };

  const available = suggestions.filter((s) => !chips.includes(s.id));

  return (
    <>
      <div className="chip-picker" onClick={() => inputRef.current?.focus()}>
        {chips.map((chip) => (
          <span key={chip} className="chip tool">
            {chip}
            <button type="button" className="x" onClick={(e) => { e.stopPropagation(); onRemove(chip); }} aria-label={`Remove ${chip}`}>
              <Icon name="x" size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="add-chip"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => { if (input.trim()) add(input); }}
          placeholder={chips.length === 0 ? placeholder : "+ add"}
        />
      </div>
      {available.length > 0 && (
        <div className="suggested-row">
          <span className="h">suggested</span>
          {available.map((s) => (
            <button key={s.id} type="button" className="suggest-chip" onClick={() => onAdd(s.id)}>
              {s.id}
              <span className="plus"><Icon name="plus" size={10} /></span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ── Effort bars ──────────────────────────────────────────────── */

function Bars({ count }: { count: number }) {
  return (
    <span className="bars">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} style={{ height: i * 3 + 2, opacity: i <= count ? 1 : 0.22 }} />
      ))}
    </span>
  );
}

/* ── Main form ────────────────────────────────────────────────── */

export function NewAgentForm() {
  const router = useRouter();
  const createMut = useCreateAgent();
  const { data: installedSkills } = useInstalledSkills();

  const [values, setValues] = useState<AgentFormValues>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<FormError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);

  const set = useCallback(<K extends keyof AgentFormValues>(key: K, val: AgentFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: val }));
  }, []);

  const errFor = (field: keyof AgentFormValues) => errors.find((e) => e.field === field)?.message;

  const slug = slugifyId(values.id || values.name);
  const unit = unitForAgent(values.name, values.unit || null);
  const skillSuggestions = (installedSkills ?? []).map((s) => ({ id: s.name }));
  const skillChips = parseCsv(values.skills);
  const toolChips = parseCsv(values.tools);
  const dirtyCount = countDirty(values);

  const sec1Done = !!(values.name.trim() && values.desc.trim());
  const sec2Done = !!(values.model && values.effort && values.pm);
  const sec3Done = toolChips.length > 0 || skillChips.length > 0;
  const sec4Done = values.body.length > 20;
  const completed = [sec1Done, sec2Done, sec3Done, sec4Done].filter(Boolean).length;

  const handleSubmit = useCallback(() => {
    setServerError(null);
    const errs = validateForm(values);
    setErrors(errs);
    if (errs.length > 0) return;
    createMut.mutate(toBody(values), {
      onSuccess: ({ id }) => router.push(PAGE_ROUTES.agent(id)),
      onError: (err) => setServerError(err instanceof Error ? err.message : String(err)),
    });
  }, [values, createMut, router]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSubmit(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleSubmit]);

  return (
    <div className="na-page">
      {/* Header */}
      <header className="na-head">
        <div>
          <div className="crumbs">
            <a onClick={() => router.push("/agents")}>Agents</a>
            <span className="sep">›</span>
            <span>New</span>
          </div>
          <h1>
            New agent
            <span className="kicker">· write a fresh markdown definition</span>
          </h1>
        </div>
        <div className="right">
          <div className="progress-bar">
            <div className="track"><div className="fill" style={{ width: `${(completed / 4) * 100}%` }} /></div>
            <span>{completed}/4 ready</span>
          </div>
          <button type="button" className="btn ghost" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="na-body">
        {/* Main column */}
        <div className="na-main">

          {/* Section 1 — Identity */}
          <SectionCard n="1" title="Identity" sub="how this agent is named and described" complete={sec1Done}>
            <div className="identity-row">
              <div className="id-avatar">
                <div className="av">
                  <AgentAvatar unit={unit} size={56} label={values.name || "Agent avatar"} />
                </div>
                <button type="button" className="swap">
                  <Icon name="refresh" size={11} /> auto
                </button>
              </div>

              <div className="field-grid">
                <div className="field full">
                  <label className="label">Name</label>
                  <div className={`input${errFor("name") ? " error" : ""}`}>
                    <input
                      value={values.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setValues((v) => ({ ...v, name, id: slugEdited ? v.id : slugifyId(name) }));
                      }}
                      placeholder="Frontend Pragmatist"
                      autoFocus
                    />
                  </div>
                  {errFor("name") && <span className="text-[11px] text-status-error">{errFor("name")}</span>}
                </div>

                <div className="field">
                  <label className="label">ID (slug) <span className="req">·</span></label>
                  <div className={`input mono${errFor("id") ? " error" : ""}`}>
                    <span className="prefix">~/.claude/agents/</span>
                    <input
                      value={values.id || slug}
                      onChange={(e) => { setSlugEdited(true); set("id", e.target.value); }}
                      placeholder="my-agent"
                    />
                    <span className="prefix">.md</span>
                  </div>
                  {errFor("id") && <span className="text-[11px] text-status-error">{errFor("id")}</span>}
                </div>

                <div className="field">
                  <label className="label justify-between">
                    <span>Description</span>
                    <span className="font-normal normal-case tracking-[0]" style={{ color: values.desc.length > DESC_MAX ? "var(--error)" : "var(--txt-4)" }}>
                      {values.desc.length}/{DESC_MAX}
                    </span>
                  </label>
                  <div className={`input${errFor("desc") ? " error" : ""}`}>
                    <input
                      value={values.desc}
                      onChange={(e) => set("desc", e.target.value)}
                      placeholder="One-line description of when to summon this agent."
                      maxLength={DESC_MAX + 20}
                    />
                  </div>
                  <div className="help">{values.desc.length} / {DESC_MAX} chars — keep it to a sentence</div>
                  {errFor("desc") && <span className="text-[11px] text-status-error">{errFor("desc")}</span>}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Section 2 — Runtime */}
          <SectionCard n="2" title="Runtime" sub="model, effort, and execution policy" complete={sec2Done}>
            {/* Model */}
            <div className="field">
              <label className="label">Model</label>
              <div className="model-cards">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`model-card${values.model === m.id ? " active" : ""}`}
                    onClick={() => set("model", m.id)}
                  >
                    <div className="row1">
                      {m.name}
                      <span className={`badge ${m.badge}`}>{m.badge}</span>
                    </div>
                    <div className="price">{m.full} · {m.price}</div>
                    <div className="desc">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="field-grid">
              {/* Effort */}
              <div className="field">
                <label className="label">Effort</label>
                <div className="effort-slider">
                  {EFFORTS.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={values.effort === e.id ? "active" : ""}
                      onClick={() => set("effort", e.id)}
                    >
                      <Bars count={e.bars} />
                      {e.id}
                    </button>
                  ))}
                </div>
                <div className="help">higher effort → more thinking tokens before responding</div>
              </div>

              {/* Room */}
              <div className="field">
                <label className="label">Room <span className="muted">· optional</span></label>
                <div className="input">
                  <input
                    value={values.room}
                    onChange={(e) => set("room", e.target.value)}
                    placeholder="e.g. Build"
                  />
                </div>
                <div className="help">where this agent lives in the office island</div>
              </div>
            </div>

            {/* Permission */}
            <div className="field">
              <label className="label">Permission mode</label>
              <div className="permission-seg">
                <button type="button" className={values.pm === "auto" ? "active" : ""} onClick={() => set("pm", "auto")}>
                  <span className="t"><Icon name="play" size={12} /> Auto</span>
                  <span className="d">trust all tool calls</span>
                </button>
                <button type="button" className={values.pm === "ask" ? "active" : ""} onClick={() => set("pm", "ask")}>
                  <span className="t"><Icon name="help-circle" size={12} /> Ask</span>
                  <span className="d">prompt on destructive ops</span>
                </button>
                <button type="button" className={values.pm === "deny" ? "active" : ""} onClick={() => set("pm", "deny")}>
                  <span className="t"><Icon name="slash" size={12} /> Deny</span>
                  <span className="d">read-only mode</span>
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Section 3 — Capabilities */}
          <SectionCard
            n="3"
            title="Capabilities"
            sub={`${skillChips.length} skills · ${toolChips.length} tools`}
            complete={sec3Done}
          >
            <div className="field">
              <label className="label"><Icon name="layers" size={11} /> Skills</label>
              <ChipPicker
                chips={skillChips}
                suggestions={skillSuggestions}
                onAdd={(v) => set("skills", toCsv([...skillChips, v]))}
                onRemove={(v) => set("skills", toCsv(skillChips.filter((c) => c !== v)))}
                placeholder="add a skill — frontend-design, research…"
              />
            </div>
            <div className="field">
              <label className="label"><Icon name="hammer" size={11} /> Tools allowed</label>
              <ChipPicker
                chips={toolChips}
                suggestions={TOOL_SUGGESTIONS}
                onAdd={(v) => set("tools", toCsv([...toolChips, v]))}
                onRemove={(v) => set("tools", toCsv(toolChips.filter((c) => c !== v)))}
                placeholder="add a tool"
              />
            </div>
          </SectionCard>

          {/* Section 4 — System prompt */}
          <SectionCard
            n="4"
            title="System prompt"
            sub={`markdown body · ${values.body.length.toLocaleString()} chars · ~${Math.round(values.body.length / 4)} tokens`}
            complete={sec4Done}
          >
            <MarkdownEditor value={values.body} onChange={(v) => set("body", v)} hasError={!!errFor("body")} />
            {errFor("body") && <span className="text-[11px] text-status-error">{errFor("body")}</span>}
            {serverError && (
              <div className="bg-status-error text-white rounded-[6px] px-3 py-2 text-[12px]">
                {serverError}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Aside column */}
        <aside className="na-aside">
          {/* Live preview */}
          <div className="aside-card">
            <div className="h">
              <Icon name="crosshair" size={11} /> Live preview
              <span className="pip">card</span>
            </div>
            <div className="live-preview">
              <div className="head">
                <div className="av">
                  <AgentAvatar unit={unit} size={32} />
                </div>
                <div className="id-blk">
                  <div className="n">{values.name.trim() || <span className="text-txt-4">Untitled agent</span>}</div>
                  <div className="s">{slug || "agent-id"}</div>
                </div>
              </div>
              <div className="descline">{values.desc || "No description yet — agents without one are hard to summon."}</div>
              <div className="stats">
                <div className="stat"><div className="l">Model</div><div className="v">{values.model || "—"}</div></div>
                <div className="stat"><div className="l">Effort</div><div className="v">{values.effort || "—"}</div></div>
                <div className="stat"><div className="l">Permission</div><div className="v">{values.pm || "—"}</div></div>
                <div className="stat"><div className="l">Tools</div><div className="v">{toolChips.length}</div></div>
              </div>
            </div>
          </div>

          {/* Tip */}
          <div className="tip-card">
            <div className="h"><Icon name="help-circle" size={11} /> Tip</div>
            Agents with clear refusal rules ship better. Tell the model what it should{" "}
            <em>not</em> do.
          </div>
        </aside>
      </div>

      {/* Save bar */}
      <div className="na-savebar">
        <div className="inner">
          <span className="dirty">
            {dirtyCount > 0 && <span className="led" />}
            {dirtyCount > 0 ? `${dirtyCount} unsaved field${dirtyCount !== 1 ? "s" : ""}` : "No changes"}
          </span>
          <span className="path">
            will write to <code>~/.claude/agents/{slug || "…"}.md</code>
          </span>
          <div className="actions">
            <button type="button" className="btn ghost" onClick={() => router.back()} disabled={createMut.isPending}>
              Cancel
            </button>
            <button type="button" className="btn primary" onClick={handleSubmit} disabled={createMut.isPending}>
              <Icon name="check" size={13} />
              {createMut.isPending ? "Creating…" : "Create agent"}
              <span className="kbd">⌘ S</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
