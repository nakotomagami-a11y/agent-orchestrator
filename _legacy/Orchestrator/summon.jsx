// summon.jsx — main panel: agent header + tabs + summon/history/config/prompt

function AgentHeader({ agent, avatarStyle, runningCount, onAbort }) {
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
        <button className="btn ghost"><I.Wrench /> Edit</button>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span className={"status-pill " + status}>
      <span className={"statusdot " + status}></span>
      {status}
    </span>
  );
}

function Tabs({ active, onChange, history }) {
  const tabs = [
    { k: "summon",  label: "Summon" },
    { k: "history", label: "History", count: history.length },
    { k: "config",  label: "Config" },
    { k: "prompt",  label: "System Prompt" },
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

function SummonPanel({ agent, run, onSummon, onAbort, onClear }) {
  const [model, setModel]   = React.useState(agent.model);
  const [effort, setEffort] = React.useState(agent.effort);
  const [budget, setBudget] = React.useState("1.50");
  const [prompt, setPrompt] = React.useState(SAMPLE_PROMPT_BODY);

  React.useEffect(() => {
    setModel(agent.model);
    setEffort(agent.effort);
  }, [agent.id]);

  return (
    <div className="summon-grid">
      {/* LEFT — input */}
      <div className="card">
        <div className="card-h">
          <span className="title">Summon</span>
          <span style={{ color: "var(--txt-3)" }}>·</span>
          <span>per-summon overrides</span>
          <div className="right">
            <span className="kbd">⌘↵</span>
          </div>
        </div>
        <div className="field-grid">
          <div className="field">
            <label>Model</label>
            <select className="select" value={model} onChange={e => setModel(e.target.value)}>
              <option value="haiku">Haiku 4.5</option>
              <option value="sonnet">Sonnet 4.5</option>
              <option value="opus">Opus 4.5</option>
            </select>
          </div>
          <div className="field">
            <label>Effort</label>
            <select className="select" value={effort} onChange={e => setEffort(e.target.value)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>
          <div className="field">
            <label>Max budget</label>
            <input className="input" value={"$" + budget}
              onChange={e => setBudget(e.target.value.replace(/[^0-9.]/g,""))} />
          </div>
        </div>

        <div className="prompt-area">
          <div className="prompt-templates">
            {PROMPT_TEMPLATES.map(t => (
              <button key={t.name} className="tag tool"
                onClick={() => setPrompt(t.body)}>
                {t.name}
              </button>
            ))}
            <button className="tag tool" style={{ marginLeft: "auto" }} title="Recent prompts">
              <I.Sparkles /> recent
            </button>
          </div>
          <textarea className="prompt-input scroll" value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={"Tell " + agent.name + " what to do…"} />
          <div className="summon-actions">
            {agent.status === "working" ? (
              <button className="btn danger" onClick={onAbort}>
                <I.Stop /> Abort
              </button>
            ) : (
              <button className="btn primary" onClick={() => onSummon({ model, effort, budget, prompt })}>
                <I.Play /> Summon
              </button>
            )}
            <button className="btn ghost"><I.Folder /> cwd: <span className="mono" style={{ marginLeft: 4 }}>~/work/agent-office</span></button>
            <div className="budget">
              ceiling <b>${budget}</b>
              <span style={{ color: "var(--line-strong)" }}>·</span>
              cost so far <b>${(run?.cost || 0).toFixed(2)}</b>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — output */}
      <div className="card output">
        <div className="card-h">
          <span className="title">Output</span>
          <span style={{ color: "var(--txt-3)" }}>·</span>
          <span>{run?.id || "no active run"}</span>
          <div className="right">
            <button className="btn ghost" style={{ height: 26, padding: "0 8px", fontSize: 11.5 }}>
              <I.Copy /> Copy
            </button>
            <button className="btn ghost" style={{ height: 26, padding: "0 8px", fontSize: 11.5 }} onClick={onClear}>
              <I.Trash /> Clear
            </button>
          </div>
        </div>
        <div className="output-body scroll">
          <Output run={run} agent={agent} />
        </div>
        <div className="output-foot">
          <span className="stat">tokens in <b>{run?.tokensIn?.toLocaleString() || "0"}</b></span>
          <span className="stat">out <b>{run?.tokensOut?.toLocaleString() || "0"}</b></span>
          <span className="stat">cost <b>${(run?.cost || 0).toFixed(2)}</b></span>
          <span className="stat">elapsed <b>{run?.elapsedStr || "0s"}</b></span>
          <div className="right">
            <span>model <b style={{ color: "var(--txt-1)" }}>{model}</b></span>
            <span>·</span>
            <span>effort <b style={{ color: "var(--txt-1)" }}>{effort}</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Output({ run, agent }) {
  if (!run) {
    return (
      <div style={{ color: "var(--txt-3)", fontSize: 12, padding: "8px 0" }}>
        <div style={{ marginBottom: 8 }}>—</div>
        <div>No active run. Hit <span className="kbd">⌘↵</span> to summon {agent.name}.</div>
      </div>
    );
  }
  return (
    <>
      <div className="turn user">
        <div className="who"><span className="badge">you</span> <span>{relTime(run.ts)}</span></div>
        <div>{run.prompt}</div>
      </div>
      <div className="turn">
        <div className="who"><span className="badge">{agent.name.toLowerCase()}</span> <span>{run.model} · {run.effort}</span></div>
        {STREAM_LINES.slice(0, run.streamCount || 0).map((l, i) => {
          if (l.tool) {
            return (
              <div key={i} className="tool">
                <span className="ok">●</span>
                <span style={{ color: "var(--txt-1)", fontWeight: 600 }}>{l.tool}</span>
                <span style={{ color: "var(--txt-2)" }}>{l.arg}</span>
                <span style={{ color: "var(--txt-3)", marginLeft: "auto" }}>{l.note}</span>
              </div>
            );
          }
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              {l.text}
              {i === (run.streamCount - 1) && run.status === "running" && <span className="cursor"></span>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function HistoryTab({ runs, onOpen }) {
  if (!runs.length) {
    return <div style={{ color: "var(--txt-3)", fontSize: 13 }}>No runs yet for this agent.</div>;
  }
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Run history</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
          {runs.length} runs
          <span style={{ margin: "0 8px", color: "var(--line-strong)" }}>·</span>
          total ${runs.reduce((s,r) => s+r.cost, 0).toFixed(2)}
          <span style={{ margin: "0 8px", color: "var(--line-strong)" }}>·</span>
          {runs.reduce((s,r) => s+r.tokensIn+r.tokensOut, 0).toLocaleString()} tokens
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn ghost" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>
            Export JSON
          </button>
        </div>
      </div>
      <div className="timeline">
        {runs.map(r => (
          <div key={r.id} className="run" onClick={() => onOpen?.(r)}>
            <div className="when">{relTime(r.ts)}</div>
            <div className="body">
              <div className="prompt">{r.prompt}</div>
              <div className="meta">
                <span className={"statusdot " + (r.status === "running" ? "working" : (r.status === "error" ? "error" : "done"))}></span>
                <span>{r.status}</span>
                <span>·</span>
                <span>{fmtDur(r.durMs)}</span>
                <span>·</span>
                <span>{r.model}/{r.effort}</span>
                <span>·</span>
                <span>{(r.tokensIn+r.tokensOut).toLocaleString()} tok</span>
              </div>
            </div>
            <div className="cost">${r.cost.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfigTab({ agent }) {
  const sections = [
    { label: "Identity", rows: [
      ["name", agent.name],
      ["id", agent.id],
      ["file", "~/.claude/agents/" + agent.id + ".md"],
    ]},
    { label: "Defaults", rows: [
      ["model", agent.model],
      ["effort", agent.effort],
      ["permission-mode", agent.pm === "auto" ? "auto-accept" : "ask"],
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
        <div className="card-h"><span className="title">Skills</span><span style={{ color: "var(--txt-3)" }}>tags this agent advertises</span></div>
        <div style={{ padding: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
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

function PromptTab({ agent }) {
  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="card-h">
        <span className="title">System Prompt</span>
        <span style={{ color: "var(--txt-3)" }}>~/.claude/agents/{agent.id}.md</span>
        <div className="right">
          <button className="btn ghost" style={{ height: 26, padding: "0 8px", fontSize: 11.5 }}>
            <I.Copy /> Copy
          </button>
          <button className="btn ghost" style={{ height: 26, padding: "0 8px", fontSize: 11.5 }}>
            <I.Wrench /> Edit
          </button>
        </div>
      </div>
      <div className="output-body scroll" style={{ background: "var(--bg-1)" }}>
        <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-wrap", color: "var(--txt-1)" }}>{SAMPLE_SYS_PROMPT}</pre>
      </div>
    </div>
  );
}

Object.assign(window, { AgentHeader, Tabs, SummonPanel, HistoryTab, ConfigTab, PromptTab, StatusPill });
