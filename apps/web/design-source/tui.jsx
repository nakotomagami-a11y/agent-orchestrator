// tui.jsx - TUI / terminal aesthetic Agent Office

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "color": "amber",
  "crt": "on",
  "scanlines": 0.65,
  "fleet": 18,
  "tab": "summon",
  "showActivity": false
}/*EDITMODE-END*/;

const ASCII_BANNER = String.raw`
 █████╗  ██████╗ ███████╗███╗   ██╗████████╗   ██████╗ ███████╗███████╗██╗ ██████╗███████╗
██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝   ██╔══██╗██╔════╝██╔════╝██║██╔════╝██╔════╝
███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║      ██║  ██║█████╗  █████╗  ██║██║     █████╗
██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║      ██║  ██║██╔══╝  ██╔══╝  ██║██║     ██╔══╝
██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║      ██████╔╝██║     ██║     ██║╚██████╗███████╗
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝      ╚═════╝ ╚═╝     ╚═╝     ╚═╝ ╚═════╝╚══════╝`;

function STATUS_DOT(s) {
  return <span className={"dot " + s}></span>;
}

function App() {
  const [color, setColor]   = React.useState(TWEAK_DEFAULTS.color);
  const [crt, setCrt]       = React.useState(TWEAK_DEFAULTS.crt);
  const [scan, setScan]     = React.useState(TWEAK_DEFAULTS.scanlines);
  const [fleet, setFleet]   = React.useState(TWEAK_DEFAULTS.fleet);
  const [tab, setTab]       = React.useState(TWEAK_DEFAULTS.tab);
  const [actOpen, setAct]   = React.useState(TWEAK_DEFAULTS.showActivity);

  const agents = React.useMemo(() => buildFleet(fleet), [fleet]);
  const history = React.useMemo(() => buildHistory(agents), [agents]);
  const [selId, setSelId] = React.useState(agents[0].id);
  const sel = agents.find(a => a.id === selId) || agents[0];

  const [query, setQuery] = React.useState("");
  const [skill, setSkill] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState(null);
  const [wizardOpen, setWizard] = React.useState(false);

  // streaming output state
  const [run, setRun] = React.useState({
    streamCount: 8, prompt: SAMPLE_PROMPT_BODY, status: "running",
    tokensIn: 1240, tokensOut: 432, cost: 0.12, elapsed: "1m 02s",
    model: sel.model, effort: sel.effort,
  });

  React.useEffect(() => {
    document.documentElement.dataset.color = color;
  }, [color]);
  React.useEffect(() => {
    document.documentElement.dataset.crt = crt;
    document.body.style.setProperty("--scanline-op", String(scan));
  }, [crt, scan]);

  // tick stream
  React.useEffect(() => {
    const id = setInterval(() => {
      setRun(r => ({
        ...r,
        streamCount: Math.min(r.streamCount + 1, STREAM_LINES.length),
        tokensOut: r.tokensOut + 30 + Math.floor(Math.random()*40),
      }));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  // keyboard tab switching
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.key === "1") setTab("summon");
      if (e.key === "2") setTab("history");
      if (e.key === "3") setTab("config");
      if (e.key === "4") setTab("prompt");
      if (e.key === "a") setAct(v => !v);
      if (e.key === "n") setWizard(true);
      if (e.key === "/") {
        e.preventDefault();
        document.querySelector(".roster .filterbar .input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = agents.filter(a => {
    if (skill && !a.skills.includes(skill)) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return a.name.toLowerCase().includes(q) ||
           a.skills.some(s => s.includes(q)) ||
           a.tools.some(t => t.toLowerCase().includes(q));
  });

  const running = agents.filter(a => a.status === "working");
  const runningCount = running.length;
  const skillCounts = {};
  agents.forEach(a => a.skills.forEach(s => skillCounts[s] = (skillCounts[s]||0)+1));
  const topSkills = Object.entries(skillCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);

  const activity = React.useMemo(() => {
    const out = [];
    running.forEach(a => {
      const r = (history[a.id]||[])[0];
      if (r) out.push({ ...r, status: "running", agentName: a.name, agentId: a.id });
    });
    Object.values(history).forEach(rs => rs.slice(0,2).forEach(r => out.push(r)));
    return out.sort((a,b) => (b.status==="running"?1:0) - (a.status==="running"?1:0) || b.ts - a.ts).slice(0, 40);
  }, [running, history]);

  const histRuns = history[sel.id] || [];

  return (
    <div className="app">
      <Banner runningCount={runningCount} agents={agents} />
      <Menubar tab={tab} setTab={setTab} onActivity={() => setAct(v=>!v)} onNew={() => setWizard(true)} actOpen={actOpen} />

      <div className="body">
        <Roster
          agents={filtered}
          allCount={agents.length}
          selId={selId} onSelect={setSelId}
          query={query} setQuery={setQuery}
          skill={skill} setSkill={setSkill}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          topSkills={topSkills}
        />
        <Main agent={sel} tab={tab} setTab={setTab} run={run} setRun={setRun} histRuns={histRuns} />
        {actOpen && <ActivityDrawer items={activity} onClose={() => setAct(false)} onJump={(id) => setSelId(id)} />}
      </div>

      <Statusbar
        runningCount={runningCount}
        running={running.map(a => ({ id: a.id, name: a.name, prompt: (history[a.id]||[])[0]?.prompt || "" }))}
        onJump={(id) => setSelId(id)}
        agents={agents}
      />

      <Tweaks
        color={color} setColor={setColor}
        crt={crt} setCrt={setCrt}
        scan={scan} setScan={setScan}
        fleet={fleet} setFleet={setFleet}
      />

      {wizardOpen && <Wizard onClose={() => setWizard(false)} />}
    </div>
  );
}

// ─── Banner ───
function Banner({ runningCount, agents }) {
  const time = React.useState(() => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }))[0];
  const [now, setNow] = React.useState(time);
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })), 1000);
    return () => clearInterval(id);
  }, []);
  const total = agents.length;
  const idle  = agents.filter(a => a.status === "idle").length;
  const err   = agents.filter(a => a.status === "error").length;
  return (
    <div className="banner">
      <pre>{ASCII_BANNER}</pre>
      <div className="meta">
        <div><b>v0.4.2</b> · local single-user · claude-code 1.4.0</div>
        <div style={{ marginTop: 2 }}>
          <span>fleet: <b>{total}</b></span>
          <span style={{ margin: "0 8px", color: "var(--line-2)" }}>|</span>
          <span>running: <b style={{ color: "var(--p)" }}>{runningCount}</b></span>
          <span style={{ margin: "0 8px", color: "var(--line-2)" }}>|</span>
          <span>idle: <b>{idle}</b></span>
          {err > 0 && <>
            <span style={{ margin: "0 8px", color: "var(--line-2)" }}>|</span>
            <span>err: <b style={{ color: "var(--err)" }}>{err}</b></span>
          </>}
        </div>
      </div>
      <div className="meta" style={{ textAlign: "right" }}>
        <div style={{ fontSize: 18, color: "var(--p)", letterSpacing: "0.05em" }}>{now}</div>
        <div className="dim">{new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }).toUpperCase()}</div>
      </div>
    </div>
  );
}

function Menubar({ tab, setTab, onActivity, onNew, actOpen }) {
  return (
    <div className="menubar">
      <button className="mi" onClick={onNew}><b>N</b>ew</button>
      <button className={"mi " + (tab==="summon"?"on":"")} onClick={() => setTab("summon")}><b>1</b> Summon</button>
      <button className={"mi " + (tab==="history"?"on":"")} onClick={() => setTab("history")}><b>2</b> History</button>
      <button className={"mi " + (tab==="config"?"on":"")} onClick={() => setTab("config")}><b>3</b> Config</button>
      <button className={"mi " + (tab==="prompt"?"on":"")} onClick={() => setTab("prompt")}><b>4</b> Prompt</button>
      <button className={"mi " + (actOpen?"on":"")} onClick={onActivity}><b>A</b>ctivity</button>
      <span className="spacer"></span>
      <span className="right"><span className="ok">●</span> connected · ANTHROPIC.SUBSCRIPTION</span>
    </div>
  );
}

// ─── Roster ───
function Roster({ agents, allCount, selId, onSelect, query, setQuery, skill, setSkill, statusFilter, setStatusFilter, topSkills }) {
  return (
    <div className="pane roster">
      <div className="pane-head">
        <b>Roster</b> [<span className="muted">{agents.length}/{allCount}</span>]
        <span className="right muted">
          press <span className="kbd">/</span> to filter
        </span>
      </div>
      <div className="filterbar">
        <input className="input" placeholder="filter / name|skill|tool…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      <div className="filterbar" style={{ borderBottom: "1px solid var(--line)" }}>
        <button className={"pill " + (statusFilter===null?"on":"")} onClick={() => setStatusFilter(null)}>any</button>
        {["working","idle","done","error","queued"].map(s => (
          <button key={s} className={"pill " + (statusFilter===s?"on":"")} onClick={() => setStatusFilter(statusFilter===s?null:s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="filterbar" style={{ borderBottom: "1px solid var(--line)" }}>
        <button className={"pill " + (skill===null?"on":"")} onClick={() => setSkill(null)}>#all</button>
        {topSkills.map(([s,n]) => (
          <button key={s} className={"pill " + (skill===s?"on":"")} onClick={() => setSkill(skill===s?null:s)}>
            #{s} {n}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>name</th>
              <th>status</th>
              <th>skills</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a, i) => (
              <tr key={a.id} className={selId===a.id?"sel":""} onClick={() => onSelect(a.id)}>
                <td className="idx">{String(i+1).padStart(2,"0")}</td>
                <td>{a.name} <span className="dim">·{a.model[0].toUpperCase()}</span></td>
                <td className="status">
                  {STATUS_DOT(a.status)}
                  <span style={{ textTransform:"uppercase", letterSpacing: "0.04em" }}>{a.status}</span>
                </td>
                <td>{a.skills.slice(0,2).map(s => <span key={s} className="skill">{s}</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main ───
function Main({ agent, tab, setTab, run, setRun, histRuns }) {
  return (
    <div className="pane main">
      <div className="headstrip">
        <div className="sprite">
          <PixelSprite id={agent.id} size={48} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1>
            {agent.name.toUpperCase()}
            <span className={"badge " + agent.status}>● {agent.status}</span>
            <span className="muted" style={{ fontSize: 11, fontWeight: 400, letterSpacing: 0 }}>
              ~/.claude/agents/{agent.id}.md
            </span>
          </h1>
          <div className="desc">{agent.desc}</div>
        </div>
        <div className="meta">
          <span>model <b>{agent.model}</b></span>
          <span className="dim">|</span>
          <span>effort <b>{agent.effort}</b></span>
          <span className="dim">|</span>
          <span>perm <b>{agent.pm}</b></span>
        </div>
      </div>

      <div className="tabs">
        <button className={tab==="summon"?"on":""} onClick={() => setTab("summon")}><span className="key">[1]</span> SUMMON</button>
        <button className={tab==="history"?"on":""} onClick={() => setTab("history")}><span className="key">[2]</span> HISTORY ({histRuns.length})</button>
        <button className={tab==="config"?"on":""} onClick={() => setTab("config")}><span className="key">[3]</span> CONFIG</button>
        <button className={tab==="prompt"?"on":""} onClick={() => setTab("prompt")}><span className="key">[4]</span> SYSTEM-PROMPT</button>
        <span className="spacer"></span>
        <span className="breadcrumb">~ <b>{agent.name}</b> / {tab}</span>
      </div>

      <div className="tab-body">
        {tab === "summon"  && <SummonView agent={agent} run={run} setRun={setRun} />}
        {tab === "history" && <HistoryView runs={histRuns} />}
        {tab === "config"  && <ConfigView agent={agent} />}
        {tab === "prompt"  && <PromptView agent={agent} />}
      </div>
    </div>
  );
}

// ─── Summon ───
function SummonView({ agent, run, setRun }) {
  const [model, setModel]   = React.useState(agent.model);
  const [effort, setEffort] = React.useState(agent.effort);
  const [budget, setBudget] = React.useState("1.50");
  const [prompt, setPrompt] = React.useState(SAMPLE_PROMPT_BODY);
  React.useEffect(() => { setModel(agent.model); setEffort(agent.effort); }, [agent.id]);

  const summon = () => setRun({
    ...run, streamCount: 1, status: "running", prompt,
    tokensIn: 240, tokensOut: 0, cost: 0.01, elapsed: "0s",
    model, effort,
  });
  const abort = () => setRun({ ...run, status: "done" });

  return (
    <div>
      <div className="box">
        <div className="box-h">┤ <b>SUMMON</b> ├ params ├ press <span className="kbd">⌘↵</span> ├</div>
        <div className="box-body">
          <div className="fields">
            <div className="f">
              <label>MODEL</label>
              <div className="seg">
                {["haiku","sonnet","opus"].map(m => (
                  <button key={m} className={model===m?"on":""} onClick={() => setModel(m)}>{m}</button>
                ))}
              </div>
            </div>
            <div className="f">
              <label>EFFORT</label>
              <div className="seg">
                {["low","medium","high"].map(m => (
                  <button key={m} className={effort===m?"on":""} onClick={() => setEffort(m)}>{m}</button>
                ))}
              </div>
            </div>
            <div className="f">
              <label>MAX-BUDGET</label>
              <input className="input" value={"$" + budget}
                onChange={e => setBudget(e.target.value.replace(/[^0-9.]/g,""))} />
            </div>
            <div className="f">
              <label>CWD</label>
              <input className="input" defaultValue="~/work/agent-office" />
            </div>
          </div>

          <div className="prompt-templates">
            {PROMPT_TEMPLATES.map(t => (
              <button key={t.name} className="tag" onClick={() => setPrompt(t.body)}>+ {t.name}</button>
            ))}
            <button className="tag" style={{ marginLeft: "auto" }}>↻ recent</button>
          </div>

          <textarea className="prompt" value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder={"> tell " + agent.name.toLowerCase() + " what to do…"} />

          <div className="actions">
            {run.status === "running" ? (
              <button className="btn danger" onClick={abort}>■ ABORT</button>
            ) : (
              <button className="btn" onClick={summon}>► SUMMON</button>
            )}
            <span className="muted" style={{ fontSize: 11 }}>
              ceiling <b style={{ color:"var(--p)" }}>${budget}</b>
              <span className="dim"> · </span>
              spent <b style={{ color:"var(--p)" }}>${run.cost.toFixed(2)}</b>
            </span>
            <span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>
              <span className="kbd">⌘↵</span> summon
              <span className="dim"> · </span>
              <span className="kbd">esc</span> abort
            </span>
          </div>
        </div>
      </div>

      <div className="output">
        <div className="o-h">
          <span>┤ <b>OUTPUT</b> ┤ stream</span>
          <span className="dim">·</span>
          <span>{agent.id}-{Date.now().toString(36).slice(-4)}</span>
          <span className="right">
            <span>● {run.status}</span>
            <span>elapsed <b>{run.elapsed}</b></span>
          </span>
        </div>
        <div className="o-body">
          <Stream agent={agent} run={run} />
        </div>
        <div className="o-foot">
          <span>tok-in <b>{run.tokensIn.toLocaleString()}</b></span>
          <span>tok-out <b>{run.tokensOut.toLocaleString()}</b></span>
          <span>cost <b>${run.cost.toFixed(2)}</b></span>
          <span style={{ marginLeft: "auto" }}>{model}/{effort}</span>
        </div>
      </div>
    </div>
  );
}

function Stream({ agent, run }) {
  return (
    <>
      <div className="line user">
        <span className="who"><b>you</b><span className="ts">{relTime(Date.now() - 62000)}</span></span>
        <div className="body">{run.prompt}</div>
      </div>
      <div className="line">
        <span className="who"><b>{agent.name.toLowerCase()}</b><span className="ts">{run.model} · {run.effort}</span></span>
        <div className="body">
          {STREAM_LINES.slice(0, run.streamCount).map((l, i) => {
            if (l.tool) {
              return (
                <div key={i} className="tool-call">
                  <span className="ok">●</span> <b>{l.tool}</b> <span className="args">{l.arg}</span>
                  <span className="note">{l.note}</span>
                </div>
              );
            }
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                {l.text}
                {i === run.streamCount - 1 && run.status === "running" && <span className="caret"></span>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── History ───
function HistoryView({ runs }) {
  if (!runs.length) {
    return <div className="box"><div className="box-h">┤ <b>HISTORY</b> ├</div><div className="box-body muted">No runs yet.</div></div>;
  }
  const total = runs.reduce((s,r) => s+r.cost, 0);
  const tok = runs.reduce((s,r) => s+r.tokensIn+r.tokensOut, 0);
  return (
    <div className="hlist box" style={{ marginTop: 14 }}>
      <div className="box-h">
        ┤ <b>HISTORY</b> ┤ {runs.length} runs ├ ${total.toFixed(2)} ├ {tok.toLocaleString()} tok ├
      </div>
      <div style={{ borderTop: "1px solid var(--line)" }}></div>
      {runs.map(r => (
        <div key={r.id} className="hrun">
          <span className="when">{relTime(r.ts)}</span>
          <span className="prompt">{r.prompt}</span>
          <span className="num">{fmtDur(r.durMs)}</span>
          <span className="num">{(r.tokensIn+r.tokensOut).toLocaleString()}t</span>
          <span className="stat">
            <span className={"dot " + (r.status==="running"?"running":(r.status==="error"?"error":"done"))}></span>
            <span className="muted">{r.model}/{r.effort}</span>
          </span>
          <span className="num"><b style={{color:"var(--p)"}}>${r.cost.toFixed(2)}</b></span>
        </div>
      ))}
    </div>
  );
}

// ─── Config ───
function ConfigView({ agent }) {
  return (
    <div>
      <div className="box">
        <div className="box-h">┤ <b>IDENTITY</b> ├</div>
        <div className="box-body">
          <div className="kv">
            <div>name</div><div className="b">{agent.name}</div>
            <div>id</div><div className="b">{agent.id}</div>
            <div>file</div><div className="b">~/.claude/agents/{agent.id}.md</div>
            <div>description</div><div>{agent.desc}</div>
          </div>
        </div>
      </div>

      <div className="box">
        <div className="box-h">┤ <b>DEFAULTS</b> ├</div>
        <div className="box-body">
          <div className="kv">
            <div>model</div><div className="b">{agent.model}</div>
            <div>effort</div><div className="b">{agent.effort}</div>
            <div>permission-mode</div><div className="b">{agent.pm}</div>
          </div>
        </div>
      </div>

      <div className="box">
        <div className="box-h">┤ <b>SKILLS</b> ├ {agent.skills.length} ├</div>
        <div className="box-body">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {agent.skills.map(s => <span key={s} className="tag skill">#{s}</span>)}
          </div>
        </div>
      </div>

      <div className="box">
        <div className="box-h">┤ <b>ALLOWED-TOOLS</b> ├ {agent.tools.length} of {TOOLS.length} ├</div>
        <div className="box-body">
          <div className="checklist">
            {TOOLS.map(t => (
              <div key={t} className={"chk " + (agent.tools.includes(t) ? "" : "off")}>
                <span className="b">[{agent.tools.includes(t) ? "✓" : " "}]</span>
                <span className="b" style={{ color: "var(--p)", fontWeight: 400 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PromptView({ agent }) {
  return (
    <div className="box" style={{ marginTop: 14 }}>
      <div className="box-h">┤ <b>SYSTEM-PROMPT</b> ┤ ~/.claude/agents/{agent.id}.md ├</div>
      <div className="box-body">
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12.5, lineHeight: 1.6, color: "var(--p)" }}>{SAMPLE_SYS_PROMPT}</pre>
      </div>
    </div>
  );
}

// ─── Activity drawer ───
function ActivityDrawer({ items, onClose, onJump }) {
  const running = items.filter(r => r.status==="running");
  const recent = items.filter(r => r.status!=="running").slice(0, 30);
  return (
    <div className="activity">
      <div className="hd">
        ┤ <b>ACTIVITY</b> ├ {running.length} live · {recent.length} recent
        <button className="btn ghost x" onClick={onClose}>[ESC] CLOSE</button>
      </div>
      <div className="body">
        <div className="a-sect">▼ RUNNING</div>
        {running.map(r => (
          <div key={r.id} className="a-row" onClick={() => onJump(r.agentId)}>
            <div className="top">
              <span className="dot working" style={{ display:"inline-block", width:8, height:8 }}></span>
              <span className="name">{r.agentName}</span>
              <span className="when">{relTime(r.ts)}</span>
            </div>
            <div className="what">{r.prompt}</div>
          </div>
        ))}
        <div className="a-sect">▼ RECENT</div>
        {recent.map(r => (
          <div key={r.id} className="a-row" onClick={() => onJump(r.agentId)}>
            <div className="top">
              <span className="dot" style={{
                display: "inline-block", width: 8, height: 8,
                background: r.status==="error"?"var(--err)":"var(--ok)",
              }}></span>
              <span className="name">{r.agentName}</span>
              <span className="when">{relTime(r.ts)}</span>
            </div>
            <div className="what">{r.prompt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Statusbar ───
function Statusbar({ runningCount, running, onJump, agents }) {
  const totalCost = (1.523).toFixed(2);
  return (
    <div className="statusbar">
      <span className="seg"><span className="dot working" style={{ display:"inline-block", width:7, height:7, marginRight: 4 }}></span> <b>{runningCount}</b> RUN</span>
      <span className="sep">|</span>
      <span className="seg"><b>{agents.length}</b> AGENTS</span>
      <span className="sep">|</span>
      <span className="seg">$<b>{totalCost}</b> TODAY</span>
      <span className="sep">|</span>
      <span className="pip-strip">
        {running.map(r => (
          <span key={r.id} className="pip" onClick={() => onJump(r.id)}>
            ▶ {r.name} <span style={{ opacity:0.7 }}>· {r.prompt.slice(0,28)}…</span>
            <span className="x">×</span>
          </span>
        ))}
      </span>
      <span className="keys">
        <span className="kbd">1-4</span> tabs
        <span className="sep" style={{ margin: "0 4px" }}>·</span>
        <span className="kbd">/</span> filter
        <span className="sep" style={{ margin: "0 4px" }}>·</span>
        <span className="kbd">A</span> activity
        <span className="sep" style={{ margin: "0 4px" }}>·</span>
        <span className="kbd">N</span> new
      </span>
    </div>
  );
}

// ─── Tweaks ───
function Tweaks({ color, setColor, crt, setCrt, scan, setScan, fleet, setFleet }) {
  const [open, setOpen] = React.useState(true);
  const handlerRef = React.useRef();

  React.useEffect(() => {
    handlerRef.current = (e) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "__activate_edit_mode") setOpen(true);
      if (e.data.type === "__deactivate_edit_mode") setOpen(false);
    };
    const fn = (e) => handlerRef.current && handlerRef.current(e);
    window.addEventListener("message", fn);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", fn);
  }, []);

  if (!open) return null;
  const close = () => {
    setOpen(false);
    window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*");
  };
  const persist = (k, v) => window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v }}, "*");

  return (
    <div className="twk">
      <div className="twk-h">
        ┤ <b>TWEAKS</b> ├
        <button className="btn ghost x" onClick={close}>×</button>
      </div>
      <div className="twk-body">
        <div className="twk-h-section">― phosphor ―</div>
        <div className="row">
          <label>color</label>
          <div className="ctl">
            {["amber","green","white","cyan","paper"].map(c => (
              <button key={c} className={color===c?"on":""}
                onClick={() => { setColor(c); persist("color", c); }}>{c}</button>
            ))}
          </div>
        </div>
        <div className="row">
          <label>crt</label>
          <div className="ctl">
            {["on","off"].map(c => (
              <button key={c} className={crt===c?"on":""}
                onClick={() => { setCrt(c); persist("crt", c); }}>{c}</button>
            ))}
          </div>
        </div>
        <div className="row">
          <label>scanlines</label>
          <input type="range" min="0" max="1" step="0.05" value={scan}
            onChange={e => { setScan(parseFloat(e.target.value)); persist("scanlines", parseFloat(e.target.value)); }} />
        </div>
        <div className="twk-h-section">― fleet ―</div>
        <div className="row">
          <label>size</label>
          <div className="ctl" style={{ alignItems: "center" }}>
            <input type="range" min="5" max="50" step="1" value={fleet}
              onChange={e => { setFleet(parseInt(e.target.value,10)); persist("fleet", parseInt(e.target.value,10)); }} />
            <span style={{ color: "var(--p)", minWidth: 24, textAlign: "right" }}>{fleet}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Wizard ───
const WSTEPS = ["Identity","Skills","Tools","Prompt","Review"];
function Wizard({ onClose }) {
  const [step, setStep] = React.useState(0);
  const [d, setD] = React.useState({
    name: "Pico", id: "pico",
    desc: "Tiny utility agent that does one small thing well.",
    skills: ["docs"], tools: ["Read","Write"], pm: "auto",
    model: "haiku", effort: "low",
    body: "# Pico\n\nYou are Pico - a tiny utility agent. Do one small thing well.\n\n## Workflow\n- Read the file or area in question\n- Make the smallest possible change\n- Confirm what you did in 1-2 lines\n",
  });
  const set = (k,v) => setD(p => ({...p, [k]: v}));

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="scrim" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="d-h">
          ┤ NEW-AGENT ├
          <span className="steps">
            {WSTEPS.map((s, i) => (
              <span key={s} className={i===step?"on":(i<step?"done":"")}>
                [{i+1}] {s}
              </span>
            ))}
          </span>
          <button className="btn ghost x" onClick={onClose}>[ESC] CLOSE</button>
        </div>
        <div className="d-body">
          {step === 0 && <WizIdentity d={d} set={set} />}
          {step === 1 && <WizSkills   d={d} set={set} />}
          {step === 2 && <WizTools    d={d} set={set} />}
          {step === 3 && <WizPrompt   d={d} set={set} />}
          {step === 4 && <WizReview   d={d} />}
        </div>
        <div className="d-foot">
          <span className="help">step {step+1}/{WSTEPS.length} · use <span className="kbd">tab</span> to advance</span>
          <span className="right">
            <button className="btn ghost" onClick={onClose}>cancel</button>
            {step > 0 && <button className="btn ghost" onClick={() => setStep(step-1)}>← back</button>}
            {step < WSTEPS.length-1 ? (
              <button className="btn" onClick={() => setStep(step+1)}>next →</button>
            ) : (
              <button className="btn" onClick={onClose}>► WRITE {d.id}.md</button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function WizIdentity({ d, set }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div className="col" style={{ display:"flex", flexDirection:"column", gap: 14 }}>
        <div className="f"><label>NAME</label><input className="input" value={d.name} onChange={e => set("name", e.target.value)} /></div>
        <div className="f"><label>ID (slug)</label><input className="input" value={d.id} onChange={e => set("id", e.target.value.replace(/[^a-z0-9-]/gi,"").toLowerCase())} /></div>
        <div className="f"><label>DESCRIPTION</label><textarea className="prompt" style={{ minHeight: 80 }} value={d.desc} onChange={e => set("desc", e.target.value)} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="f"><label>MODEL</label>
            <div className="seg">{["haiku","sonnet","opus"].map(m =>
              <button key={m} className={d.model===m?"on":""} onClick={() => set("model", m)}>{m}</button>)}
            </div>
          </div>
          <div className="f"><label>EFFORT</label>
            <div className="seg">{["low","medium","high"].map(m =>
              <button key={m} className={d.effort===m?"on":""} onClick={() => set("effort", m)}>{m}</button>)}
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="muted" style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom: 8 }}>preview</div>
        <div className="box" style={{ margin: 0 }}>
          <div className="box-h">┤ ROSTER-ENTRY ├</div>
          <div className="box-body">
            <div style={{ display: "flex", gap: 12, alignItems:"flex-start" }}>
              <div className="sprite" style={{ width: 40, height: 40 }}><PixelSprite id={d.id||"x"} size={40} /></div>
              <div>
                <div className="b">{d.name || "Untitled"}</div>
                <div className="muted" style={{ fontSize: 11 }}>~/.claude/agents/{d.id}.md</div>
                <div style={{ fontSize: 12, color: "var(--p-soft)", marginTop: 6 }}>{d.desc}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WizSkills({ d, set }) {
  const toggle = s => {
    const has = d.skills.includes(s);
    set("skills", has ? d.skills.filter(x => x!==s) : [...d.skills, s]);
  };
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, marginBottom: 10 }}>Multi-select. Used for filtering & floor plan.</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {SKILLS.map(s => (
          <button key={s} className={"tag " + (d.skills.includes(s)?"skill":"")} onClick={() => toggle(s)}>
            [{d.skills.includes(s)?"✓":" "}] #{s}
          </button>
        ))}
      </div>
    </div>
  );
}

function WizTools({ d, set }) {
  const toggle = t => {
    const has = d.tools.includes(t);
    set("tools", has ? d.tools.filter(x => x!==t) : [...d.tools, t]);
  };
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, marginBottom: 10 }}>Allowed tools (default-deny everything else).</div>
      <div className="checklist">
        {TOOLS.map(t => (
          <button key={t} className={"chk " + (d.tools.includes(t)?"":"off")} onClick={() => toggle(t)}
            style={{ background:"transparent", border: 0, padding: 0, textAlign:"left" }}>
            <span className="b">[{d.tools.includes(t)?"✓":" "}]</span>
            <span style={{ color: d.tools.includes(t) ? "var(--p)":"var(--p-dim)" }}>{t}</span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Permission mode</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[["ask","Ask before each tool call"],["auto","Auto-accept allowed tools"],["plan","Plan-only (never execute)"]].map(([k,t]) => (
            <button key={k} className={"btn " + (d.pm===k?"":"ghost")} onClick={() => set("pm", k)}
              style={{ flex: 1, padding: 10, textAlign:"left", textTransform:"none", letterSpacing: 0, fontWeight: 400 }}>
              <div className="b" style={{ marginBottom: 4, textTransform:"uppercase", letterSpacing:"0.04em" }}>{k}</div>
              <div className="muted" style={{ fontSize: 11 }}>{t}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WizPrompt({ d, set }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns: "1fr 1fr", gap: 20, height: 460 }}>
      <div className="f" style={{ minHeight: 0 }}>
        <label>SYSTEM-PROMPT.md</label>
        <textarea className="prompt" style={{ flex: 1, minHeight: 380 }} value={d.body} onChange={e => set("body", e.target.value)} />
      </div>
      <div className="box" style={{ margin: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div className="box-h">┤ PREVIEW ├</div>
        <div className="box-body" style={{ overflow: "auto" }}>
          <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--p)" }}>{d.body}</pre>
        </div>
      </div>
    </div>
  );
}

function WizReview({ d }) {
  const text = `---
name: ${d.name}
id: ${d.id}
description: ${d.desc}
model: ${d.model}
effort: ${d.effort}
skills: [${d.skills.join(", ")}]
allowed-tools: [${d.tools.join(", ")}]
permission-mode: ${d.pm}
---

` + d.body;
  return (
    <div className="box" style={{ margin: 0 }}>
      <div className="box-h">┤ ~/.claude/agents/{d.id}.md ├ {(text.length/1024).toFixed(2)} KB ├</div>
      <div className="box-body">
        <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", color:"var(--p)" }}>{text}</pre>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />);
