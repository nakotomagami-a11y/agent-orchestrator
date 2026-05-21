// activity.jsx - global activity drawer + bottom PIP strip + wizard

function ActivityDrawer({ items, onClose, onJump }) {
  const running = items.filter(r => r.status === "running");
  const recent  = items.filter(r => r.status !== "running").slice(0, 30);
  return (
    <aside className="activity">
      <div className="activity-head">
        <I.Activity />
        <span className="title">Activity</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--txt-3)" }}>
          {running.length} running · {recent.length} recent
        </span>
        <button className="topbar-btn" style={{ height: 24, padding: "0 6px" }} onClick={onClose}>
          <I.X />
        </button>
      </div>
      <div className="activity-list scroll">
        {running.length > 0 && (
          <>
            <div style={{
              padding: "8px 14px 4px", fontFamily: "var(--mono)", fontSize: 10,
              textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--txt-3)",
            }}>Running now</div>
            {running.map(r => <ActivityItem key={r.id} run={r} onJump={onJump} />)}
          </>
        )}
        <div style={{
          padding: "12px 14px 4px", fontFamily: "var(--mono)", fontSize: 10,
          textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--txt-3)",
        }}>Recent</div>
        {recent.map(r => <ActivityItem key={r.id} run={r} onJump={onJump} />)}
      </div>
    </aside>
  );
}

function ActivityItem({ run, onJump }) {
  const dotClass = run.status === "running" ? "working" : (run.status === "error" ? "error" : "done");
  return (
    <div className="activity-item" onClick={() => onJump(run.agentId)}>
      <span className={"statusdot " + dotClass}></span>
      <div style={{ minWidth: 0 }}>
        <div className="name">{run.agentName}</div>
        <div className="what">{run.prompt}</div>
      </div>
      <div className="when">{relTime(run.ts)}</div>
    </div>
  );
}

function PipStrip({ runs, onJump, onDismiss }) {
  if (!runs.length) return null;
  return (
    <div className="pip-strip">
      {runs.map(r => (
        <div key={r.id} className={"pip " + (r.status === "running" ? "" : r.status)} onClick={() => onJump(r.agentId)}>
          <span className="dot"></span>
          <span style={{ color: "var(--txt)", fontWeight: 500 }}>{r.agentName}</span>
          <span style={{ color: "var(--txt-3)" }}>·</span>
          <span style={{
            maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{r.prompt.slice(0, 32)}…</span>
          <span className="x" onClick={e => { e.stopPropagation(); onDismiss(r.id); }}>×</span>
        </div>
      ))}
    </div>
  );
}

// ─────────── Wizard ───────────

const WIZ_STEPS = [
  { k: "identity",  title: "Identity",   desc: "Name, description, where the file lives." },
  { k: "skills",    title: "Skills",     desc: "Tags this agent advertises." },
  { k: "tools",     title: "Tools",      desc: "Allowed tools + permission mode." },
  { k: "prompt",    title: "Prompt",     desc: "The system prompt body." },
  { k: "review",    title: "Review",     desc: "Confirm and write the .md file." },
];

function Wizard({ onClose, onCreate }) {
  const [step, setStep] = React.useState(0);
  const [data, setData] = React.useState({
    name: "Pico",
    id: "pico",
    desc: "Tiny utility agent that does one small thing well.",
    skills: ["docs"],
    tools: ["Read", "Write"],
    pm: "auto",
    model: "haiku",
    effort: "low",
    body: "# Pico\n\nYou are Pico - a tiny utility agent. Do one small thing well.\n\n## Workflow\n- Read the file or area in question\n- Make the smallest possible change\n- Confirm what you did in 1-2 lines\n",
  });

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  return (
    <div className="wizard-scrim" onClick={onClose}>
      <div className="wizard" onClick={e => e.stopPropagation()}>
        <div className="wizard-head">
          <h2>Create agent</h2>
          <div className="steps">
            {WIZ_STEPS.map((s, i) => (
              <span key={s.k} className={"step-pip " + (i === step ? "on" : (i < step ? "done" : ""))}>
                <span className="n">{i < step ? "✓" : i+1}</span>
                {s.title}
              </span>
            ))}
          </div>
          <button className="x" onClick={onClose}>×</button>
        </div>

        <div className="wizard-body scroll">
          {step === 0 && <WizIdentity data={data} set={set} />}
          {step === 1 && <WizSkills   data={data} set={set} />}
          {step === 2 && <WizTools    data={data} set={set} />}
          {step === 3 && <WizPrompt   data={data} set={set} />}
          {step === 4 && <WizReview   data={data} />}
        </div>

        <div className="wizard-foot">
          <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
            step {step+1} of {WIZ_STEPS.length} · {WIZ_STEPS[step].desc}
          </div>
          <div className="right">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            {step > 0 && <button className="btn" onClick={() => setStep(step-1)}>Back</button>}
            {step < WIZ_STEPS.length - 1 ? (
              <button className="btn primary" onClick={() => setStep(step+1)}>Next <I.Chevron /></button>
            ) : (
              <button className="btn primary" onClick={() => onCreate(data)}>
                <I.Check /> Write {data.id}.md
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {hint && <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function WizIdentity({ data, set }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <FieldGroup label="Name" hint="display name">
          <input className="input" value={data.name} onChange={e => set("name", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="ID" hint="filename slug → ~/.claude/agents/{id}.md">
          <input className="input" value={data.id} onChange={e => set("id", e.target.value.replace(/[^a-z0-9-]/gi,"").toLowerCase())} />
        </FieldGroup>
        <FieldGroup label="Description" hint="2 lines, surfaced in the roster">
          <textarea className="prompt-input" style={{ minHeight: 84 }}
            value={data.desc} onChange={e => set("desc", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Defaults" hint="model + effort baseline">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select className="select" value={data.model} onChange={e => set("model", e.target.value)}>
              <option value="haiku">Haiku 4.5</option>
              <option value="sonnet">Sonnet 4.5</option>
              <option value="opus">Opus 4.5</option>
            </select>
            <select className="select" value={data.effort} onChange={e => set("effort", e.target.value)}>
              <option value="low">low effort</option>
              <option value="medium">medium effort</option>
              <option value="high">high effort</option>
            </select>
          </div>
        </FieldGroup>
      </div>
      <div>
        <div className="mono" style={{ fontSize: 10, color: "var(--txt-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Preview</div>
        <div className="card" style={{ padding: 14, gap: 10, display: "flex", flexDirection: "column" }}>
          <div className="row">
            <Avatar agent={{ id: data.id || "x", name: data.name, glyph: "◯" }} style="sprite" size={36} />
            <div>
              <div style={{ fontWeight: 600 }}>{data.name || "Untitled"}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>{data.id}.md</div>
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--txt-2)", lineHeight: 1.5 }}>{data.desc}</div>
        </div>
      </div>
    </div>
  );
}

function WizSkills({ data, set }) {
  const toggle = (s) => {
    const has = data.skills.includes(s);
    set("skills", has ? data.skills.filter(x => x !== s) : [...data.skills, s]);
  };
  return (
    <div>
      <FieldGroup label="Skills" hint="multi-select. Used for filtering and the floor plan.">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SKILLS.map(s => (
            <button key={s} className={"chip " + (data.skills.includes(s) ? "on" : "")}
              onClick={() => toggle(s)}>
              {data.skills.includes(s) && <I.Check style={{ width: 11, height: 11 }} />} {s}
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Selected" hint={data.skills.length + " skills"}>
        <div style={{ padding: 14, background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {data.skills.length === 0 && <span className="muted" style={{ fontSize: 12 }}>No skills selected</span>}
          {data.skills.map(s => <span key={s} className="tag skill">#{s}</span>)}
        </div>
      </FieldGroup>
    </div>
  );
}

function WizTools({ data, set }) {
  const toggle = (t) => {
    const has = data.tools.includes(t);
    set("tools", has ? data.tools.filter(x => x !== t) : [...data.tools, t]);
  };
  return (
    <div>
      <FieldGroup label="Allowed tools" hint="explicit allow-list. Default-deny everything else.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
          {TOOLS.map(t => {
            const on = data.tools.includes(t);
            return (
              <button key={t}
                onClick={() => toggle(t)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px",
                  background: on ? "var(--acc-faint)" : "var(--bg-2)",
                  border: "1px solid " + (on ? "color-mix(in oklch, var(--acc) 50%, transparent)" : "var(--line)"),
                  borderRadius: 6, color: on ? "var(--acc)" : "var(--txt-1)",
                  fontFamily: "var(--mono)", fontSize: 12, textAlign: "left",
                }}>
                {on ? <I.Check /> : <span style={{ width: 14, display: "inline-block" }}></span>}
                {t}
              </button>
            );
          })}
        </div>
      </FieldGroup>
      <FieldGroup label="Permission mode" hint="how the agent gets approval to use tools">
        <div style={{ display: "flex", gap: 8 }}>
          {[
            ["ask", "Ask before each tool call", "Safest. You approve every action."],
            ["auto", "Auto-accept allowed tools", "Trust the allow-list above."],
            ["plan", "Plan-only", "Agent proposes; never executes."],
          ].map(([k, t, d]) => (
            <button key={k} onClick={() => set("pm", k)} style={{
              flex: 1, textAlign: "left", padding: "12px 14px",
              background: data.pm === k ? "var(--acc-faint)" : "var(--bg-2)",
              border: "1px solid " + (data.pm === k ? "color-mix(in oklch, var(--acc) 50%, transparent)" : "var(--line)"),
              borderRadius: 6,
            }}>
              <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 4, color: data.pm === k ? "var(--acc)" : "var(--txt)" }}>{t}</div>
              <div style={{ fontSize: 11.5, color: "var(--txt-2)" }}>{d}</div>
            </button>
          ))}
        </div>
      </FieldGroup>
    </div>
  );
}

function WizPrompt({ data, set }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, height: 460 }}>
      <div className="col" style={{ minHeight: 0 }}>
        <FieldGroup label="System prompt" hint="markdown body of the .md file">
          <textarea className="prompt-input scroll" style={{ minHeight: 380 }}
            value={data.body} onChange={e => set("body", e.target.value)} />
        </FieldGroup>
      </div>
      <div className="col" style={{ minHeight: 0 }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--txt-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Live preview</div>
        <div className="card scroll" style={{ flex: 1, overflow: "auto" }}>
          <div style={{ padding: 16 }}>
            <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--txt-1)" }}>{data.body}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function WizReview({ data }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 24 }}>
      <div>
        <FieldGroup label="Summary">
          <div className="card">
            <div style={{ padding: 14 }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <Avatar agent={{ id: data.id, name: data.name, glyph: "◯" }} style="sprite" size={40} />
                <div>
                  <div style={{ fontWeight: 600 }}>{data.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>~/.claude/agents/{data.id}.md</div>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--txt-2)", marginBottom: 12 }}>{data.desc}</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 12 }}>
                <span className="mono muted">model</span><span className="mono">{data.model}/{data.effort}</span>
                <span className="mono muted">skills</span>
                <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {data.skills.map(s => <span key={s} className="tag skill">#{s}</span>)}
                </span>
                <span className="mono muted">tools</span>
                <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {data.tools.map(t => <span key={t} className="tag tool">{t}</span>)}
                </span>
                <span className="mono muted">perm-mode</span><span className="mono">{data.pm}</span>
              </div>
            </div>
          </div>
        </FieldGroup>
      </div>
      <div>
        <FieldGroup label="File contents" hint="markdown that will be written">
          <div className="card scroll" style={{ maxHeight: 380, overflow: "auto" }}>
            <pre style={{ margin: 0, padding: 16, fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--txt-1)" }}>{
`---
name: ${data.name}
id: ${data.id}
description: ${data.desc}
model: ${data.model}
effort: ${data.effort}
skills: [${data.skills.join(", ")}]
allowed-tools: [${data.tools.join(", ")}]
permission-mode: ${data.pm}
---

` + data.body
            }</pre>
          </div>
        </FieldGroup>
      </div>
    </div>
  );
}

Object.assign(window, { ActivityDrawer, PipStrip, Wizard });
