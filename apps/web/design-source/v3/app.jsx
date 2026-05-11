// v3/app.jsx — main app: GNOME window, sidebar, office, chat, tweaks

const { useState, useEffect, useMemo, useRef } = React;

const V3_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "#E95420",
  "gamified": true,
  "density": "comfortable",
  "showBubbles": true,
  "wallpaper": "yaru"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = window.useTweaks ? window.useTweaks(V3_DEFAULTS) : [V3_DEFAULTS, () => {}];

  const [view, setView] = useState("office"); // office | activity | templates
  const [selectedId, setSelectedId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [rosterFilter, setRosterFilter] = useState("");
  const [activeAgents, setActiveAgents] = useState(["frontend-architect", "backend-builder", "qa-explorer", "ml-auger"]);
  const [zoom, setZoom] = useState(1);
  const [showInspector, setShowInspector] = useState(false);

  const agents = V3_AGENTS;
  const activity = useMemo(() => v3BuildActivity(agents), []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", t.theme);
    document.documentElement.style.setProperty("--acc", t.accent);
    document.documentElement.style.setProperty("--acc-hover", shadeColor(t.accent, -12));
    document.documentElement.style.setProperty("--acc-faint", t.accent + "1a");
    document.documentElement.style.setProperty("--acc-tint", t.accent + "29");
    document.documentElement.style.setProperty("--working", t.accent);
  }, [t.theme, t.accent]);

  const selected = agents.find(a => a.id === selectedId);

  const onSelectAgent = (id) => {
    setSelectedId(id);
    setShowInspector(true);
  };

  const onOpenChat = (id) => {
    setSelectedId(id);
    setChatOpen(true);
    setShowInspector(false);
    if (!activeAgents.includes(id)) setActiveAgents(a => [...a, id]);
  };

  const onCloseChat = () => {
    setChatOpen(false);
  };

  const onMinimizeChat = () => {
    setChatOpen(false);
    // remains in activeAgents
  };

  // global key: Esc to close chat / inspector
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (chatOpen) setChatOpen(false);
        else if (showInspector) setShowInspector(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, showInspector]);

  return (
    <>
      <div className="gnome-window">
        <TitleBar tweaks={t} setTweak={setTweak} />
        <div className="win-body">
          <Sidebar
            agents={agents}
            selectedId={selectedId}
            onSelect={onSelectAgent}
            onOpenChat={onOpenChat}
            filter={rosterFilter}
            setFilter={setRosterFilter}
            view={view}
            setView={setView}
          />
          <div className="main">
            {chatOpen && selected ? (
              <ChatPanel
                agent={selected}
                onClose={onCloseChat}
                onMinimize={onMinimizeChat}
              />
            ) : (
              <>
                {view === "office" && (
                  <>
                    <OfficeToolbar
                      gamified={t.gamified}
                      setGamified={(v) => setTweak("gamified", v)}
                      zoom={zoom} setZoom={setZoom}
                      onNew={() => alert("Open new-agent wizard")}
                    />
                    <div className="office">
                      <OfficeHUD agents={agents} activeCount={activeAgents.length} />
                      <IsoOffice
                        agents={agents}
                        selectedId={selectedId}
                        onSelect={onSelectAgent}
                        gamified={t.gamified}
                        zoom={zoom}
                      />

                      {t.gamified && (
                        <div className="office-zoom">
                          <button onClick={() => setZoom(z => Math.max(0.6, z - 0.1))}>−</button>
                          <div className="sep" />
                          <button onClick={() => setZoom(1)} style={{ fontSize: 11 }}>{Math.round(zoom*100)}%</button>
                          <div className="sep" />
                          <button onClick={() => setZoom(z => Math.min(1.6, z + 0.1))}>+</button>
                        </div>
                      )}

                      <PipStrip
                        activeAgents={activeAgents}
                        agents={agents}
                        onClick={(id) => onOpenChat(id)}
                      />

                      {showInspector && selected && (
                        <Inspector
                          agent={selected}
                          activity={activity.filter(a => a.agentId === selected.id).slice(0, 6)}
                          onClose={() => setShowInspector(false)}
                          onOpenChat={() => onOpenChat(selected.id)}
                        />
                      )}
                    </div>
                  </>
                )}
                {view === "activity" && (
                  <ActivityView activity={activity} agents={agents} onOpen={onOpenChat} />
                )}
                {view === "templates" && (
                  <TemplatesView />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <V3TweaksPanel t={t} setTweak={setTweak} />
    </>
  );
}

function shadeColor(hex, percent) {
  const f = parseInt(hex.slice(1), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const R = f >> 16, G = (f >> 8) & 0x00FF, B = f & 0x0000FF;
  const r = Math.round((t - R) * p) + R;
  const g = Math.round((t - G) * p) + G;
  const b = Math.round((t - B) * p) + B;
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ── Title bar ──
function TitleBar({ tweaks, setTweak }) {
  return (
    <div className="titlebar">
      <div className="tb-left">
        <div className="win-controls">
          <span className="win-dot close">×</span>
          <span className="win-dot min">−</span>
          <span className="win-dot max">□</span>
        </div>
        <button className="tb-btn"><II.Folder /> File</button>
        <button className="tb-btn">Edit</button>
        <button className="tb-btn">View</button>
        <button className="tb-btn">Agent</button>
        <button className="tb-btn">Help</button>
      </div>
      <div className="tb-title">
        <span style={{
          display: "inline-block", width: 16, height: 16, borderRadius: 4,
          background: "linear-gradient(135deg, var(--yaru-orange), var(--yaru-purple))",
        }}></span>
        Agent Office — Studio
      </div>
      <div className="tb-right">
        <button className={"tb-btn " + (tweaks.theme === "dark" ? "on" : "")}
          onClick={() => setTweak("theme", tweaks.theme === "dark" ? "light" : "dark")}>
          {tweaks.theme === "dark" ? "☾ Dark" : "☀ Light"}
        </button>
      </div>
    </div>
  );
}

// ── Sidebar ──
function Sidebar({ agents, selectedId, onSelect, onOpenChat, filter, setFilter, view, setView }) {
  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    if (!q) return agents;
    return agents.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.skills.some(s => s.includes(q)) ||
      (a.task || "").toLowerCase().includes(q)
    );
  }, [agents, filter]);
  const workingCount = agents.filter(a => a.status === "working" || a.status === "thinking").length;

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">A</div>
        <div>
          <div className="brand-name">Agent Office</div>
          <div className="brand-sub">studio · v3.0</div>
        </div>
      </div>

      <nav className="nav">
        <button className={"nav-item " + (view === "office" ? "on" : "")} onClick={() => setView("office")}>
          <II.Home /> Office
          <span className="badge">{workingCount} live</span>
        </button>
        <button className={"nav-item " + (view === "activity" ? "on" : "")} onClick={() => setView("activity")}>
          <II.Activity /> Activity
        </button>
        <button className={"nav-item " + (view === "templates" ? "on" : "")} onClick={() => setView("templates")}>
          <II.Templates /> Templates
        </button>
      </nav>

      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
        <div className="section-h" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Roster · {agents.length}</span>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter…"
            style={{
              marginLeft: "auto",
              background: "var(--bg-1)", border: "1px solid var(--line)",
              borderRadius: 6, padding: "3px 8px",
              fontFamily: "var(--font-mono)", fontSize: 11,
              color: "var(--txt)",
              width: 110, outline: "none",
            }}
          />
        </div>
        <div className="roster-list">
          {filtered.map(a => (
            <div key={a.id}
              className={"roster-row " + (selectedId === a.id ? "on" : "")}
              onClick={() => onSelect(a.id)}
              onDoubleClick={() => onOpenChat(a.id)}
              title="Double-click to open chat">
              <div className="av"><PxSprite agent={a} size={32} animate={false} action={a.status === "working" ? "typing" : "idle"} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="nm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                <div className="ml" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.status === "idle" ? "ready" :
                   a.status === "done" ? "✓ " + (a.taskKind || "done") :
                   a.status === "queued" ? "in queue" :
                   a.status === "error" ? "needs attention" :
                   (a.task ? a.task : a.status)}
                </div>
              </div>
              <span className={"st " + a.status} title={a.status} />
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-foot">
        <div className="me">JO</div>
        <div>
          <div className="me-name">Jo Park</div>
          <div className="me-sub">workspace · acme</div>
        </div>
        <div className="foot-spend">$4.18 today</div>
      </div>
    </aside>
  );
}

// ── Office toolbar ──
function OfficeToolbar({ gamified, setGamified, zoom, setZoom, onNew }) {
  return (
    <div className="toolbar">
      <h1>The office</h1>
      <span className="sub">·  16 agents · 4 working</span>
      <div className="right">
        <div style={{
          display: "inline-flex", border: "1px solid var(--line-2)", borderRadius: 8,
          overflow: "hidden", background: "var(--bg-1)",
        }}>
          <button
            className="btn sm ghost"
            style={{
              borderRadius: 0, height: 30,
              background: gamified ? "var(--acc)" : "transparent",
              color: gamified ? "white" : "var(--txt-2)",
              boxShadow: "none",
            }}
            onClick={() => setGamified(true)}>
            <II.Map /> Iso
          </button>
          <button
            className="btn sm ghost"
            style={{
              borderRadius: 0, height: 30,
              background: !gamified ? "var(--acc)" : "transparent",
              color: !gamified ? "white" : "var(--txt-2)",
              boxShadow: "none",
            }}
            onClick={() => setGamified(false)}>
            <II.Grid /> Cards
          </button>
        </div>
        <button className="btn sm primary" onClick={onNew}><II.Plus /> New agent</button>
      </div>
    </div>
  );
}

// ── Office HUD (top stats) ──
function OfficeHUD({ agents, activeCount }) {
  const working = agents.filter(a => a.status === "working" || a.status === "thinking").length;
  const idle = agents.filter(a => a.status === "idle").length;
  const errors = agents.filter(a => a.status === "error").length;
  return (
    <div className="office-hud">
      <div className="hud-card"><span style={{ width: 8, height: 8, borderRadius: 50, background: "var(--working)", display: "inline-block" }}></span> <b>{working}</b> live</div>
      <div className="hud-card"><span style={{ width: 8, height: 8, borderRadius: 50, background: "var(--idle)", display: "inline-block" }}></span> <b>{idle}</b> idle</div>
      {errors > 0 && <div className="hud-card"><span style={{ width: 8, height: 8, borderRadius: 50, background: "var(--error)", display: "inline-block" }}></span> <b>{errors}</b> need attention</div>}
      <div style={{ flex: 1 }} />
      <div className="hud-card">Spend today <b className="accent">$4.18</b></div>
      <div className="hud-card">Budget <b>$50.00</b> daily</div>
    </div>
  );
}

// ── Pip strip (active background agents) ──
function PipStrip({ activeAgents, agents, onClick }) {
  if (!activeAgents || activeAgents.length === 0) return null;
  return (
    <div className="pip-strip">
      {activeAgents.map(id => {
        const a = agents.find(x => x.id === id);
        if (!a) return null;
        return (
          <div key={id} className="pip" onClick={() => onClick(id)}>
            <span className="pdot" style={{ background: a.status === "error" ? "var(--error)" : a.status === "done" ? "var(--done)" : "var(--working)" }} />
            <span>{a.short}</span>
            <span style={{ color: "var(--txt-3)", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
              {a.task ? (a.task.length > 18 ? a.task.slice(0,18)+"…" : a.task) : "idle"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Inspector ──
function Inspector({ agent, activity, onClose, onOpenChat }) {
  return (
    <div className="inspector">
      <div className="ihead">
        <div style={{ width: 36, height: 36 }}>
          <PxSprite agent={agent} size={36} animate={false} action={agent.status === "working" ? "typing" : "idle"} />
        </div>
        <div>
          <h3>{agent.name}</h3>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--txt-3)" }}>
            {agent.id}
          </div>
        </div>
        <button className="iclose" onClick={onClose}><II.X /></button>
      </div>
      <div className="desc">{agent.desc}</div>
      <div className="kv">
        <span className="k">role</span><span className="v">{agent.role}</span>
        <span className="k">model</span><span className="v">{agent.model} · {agent.effort}</span>
        <span className="k">skills</span><span className="v">{agent.skills.map(s => "#"+s).join(" ")}</span>
        <span className="k">tools</span><span className="v">{agent.tools.length} allowed</span>
        <span className="k">status</span><span className="v" style={{ color: agent.status === "error" ? "var(--error)" : agent.status === "working" ? "var(--acc)" : "var(--txt)" }}>
          {agent.status}{agent.task ? " — " + agent.task : ""}
        </span>
      </div>
      <div className="iactivity">
        <div style={{ padding: "8px 0 4px", color: "var(--txt-3)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Recent activity</div>
        {activity.length === 0 ? (
          <div style={{ color: "var(--txt-3)", fontStyle: "italic", padding: "8px 0" }}>No recent activity.</div>
        ) : activity.map((a, i) => (
          <div key={i} className="iact-row">
            <span style={{ color: "var(--acc)", fontFamily: "var(--font-mono)", textTransform: "uppercase", fontSize: 10, width: 38, flexShrink: 0 }}>{a.kind}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 11 }}>{a.what}</span>
            <span style={{ color: "var(--txt-3)", fontFamily: "var(--font-mono)", fontSize: 10.5, flexShrink: 0 }}>{window.v3Rel(a.ts)} ago</span>
          </div>
        ))}
      </div>
      <div className="ibtns">
        <button className="btn primary" style={{ flex: 1 }} onClick={onOpenChat}>
          <II.Send /> Open chat
        </button>
        <button className="btn"><II.Edit /></button>
        <button className="btn"><II.Branch /></button>
      </div>
    </div>
  );
}

// ── Activity view ──
function ActivityView({ activity, agents, onOpen }) {
  return (
    <div className="tab-pane">
      <div className="card">
        <div className="card-h">
          <span className="title">Activity</span>
          <span className="sub">all tool calls and edits across the fleet · {activity.length} events</span>
        </div>
        <div style={{ padding: 6 }}>
          {activity.map((ev, i) => {
            const a = agents.find(x => x.id === ev.agentId);
            return (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 12,
                alignItems: "center", padding: "8px 10px",
                borderBottom: "1px solid var(--line)", cursor: "pointer",
              }} onClick={() => onOpen(ev.agentId)}>
                <div style={{ width: 26, height: 26 }}>
                  <PxSprite agent={a} size={26} animate={false} action="idle" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5 }}>
                    <b>{ev.agentName}</b>
                    <span style={{ color: "var(--txt-3)" }}> · </span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--acc)", textTransform: "uppercase", fontSize: 11 }}>{ev.kind}</span>
                    <span style={{ color: "var(--txt-3)" }}> · </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{ev.what}</span>
                  </div>
                </div>
                <div style={{ color: "var(--txt-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{window.v3Rel(ev.ts)} ago</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TemplatesView() {
  const tpl = [
    { name: "PR reviewer", desc: "Reads diff, flags risk, suggests fixes — never edits.", model: "sonnet", uses: 412 },
    { name: "Codebase cartographer", desc: "Maps repo structure into a single index for new contributors.", model: "opus", uses: 87 },
    { name: "Release-note writer", desc: "Reads merged PRs, drafts a release-note in your team's voice.", model: "haiku", uses: 233 },
    { name: "Dep updater", desc: "Bumps dependencies, runs tests, opens a PR — backs out on red.", model: "sonnet", uses: 198 },
    { name: "Bug repro-r", desc: "Reads an issue, drives a browser, files a clean repro.", model: "sonnet", uses: 64 },
    { name: "Story writer", desc: "Turns Linear tickets into UI stories with acceptance criteria.", model: "haiku", uses: 156 },
  ];
  return (
    <div className="tab-pane">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {tpl.map(t => (
          <div key={t.name} className="card" style={{ padding: 16, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8,
                background: "linear-gradient(135deg, var(--yaru-orange), var(--yaru-purple))",
                color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 14 }}>
                {t.name[0]}
              </div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{t.name}</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--txt-2)", lineHeight: 1.5, marginBottom: 12, minHeight: 38 }}>
              {t.desc}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="tag">{t.model}</span>
              <span style={{ fontSize: 11, color: "var(--txt-3)", fontFamily: "var(--font-mono)" }}>{t.uses} uses</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tweaks panel ──
function V3TweaksPanel({ t, setTweak }) {
  if (!window.TweaksPanel) return null;
  const {
    TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor, TweakSelect,
  } = window;
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Theme">
        <TweakRadio label="Mode" value={t.theme} onChange={v => setTweak("theme", v)}
          options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
        <TweakColor label="Accent" value={t.accent} onChange={v => setTweak("accent", v)}
          options={[
            "#E95420", // yaru orange
            "#77216F", // aubergine
            "#0E8420", // green
            "#1E66BE", // blue
            "#C28A00", // amber
          ]} />
      </TweakSection>
      <TweakSection title="Office">
        <TweakToggle label="Iso view" value={t.gamified} onChange={v => setTweak("gamified", v)} />
        <TweakToggle label="Status bubbles" value={t.showBubbles} onChange={v => setTweak("showBubbles", v)} />
      </TweakSection>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />);
