// app.jsx — main composition

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "jade",
  "density": "regular",
  "view": "list",
  "metaphor": "icons",
  "avatar": "sprite",
  "fleet": 18,
  "showPipStrip": true,
  "openOnLoad": "summon"
}/*EDITMODE-END*/;

const ACCENT_PALETTES = {
  jade:    { acc: "oklch(0.78 0.13 168)", accD: "oklch(0.42 0.10 168)", text: "oklch(0.16 0.02 168)" },
  amber:   { acc: "oklch(0.82 0.15 80)",  accD: "oklch(0.50 0.12 80)",  text: "oklch(0.18 0.04 80)"  },
  iris:    { acc: "oklch(0.74 0.16 280)", accD: "oklch(0.42 0.13 280)", text: "oklch(0.96 0.02 280)" },
  rose:    { acc: "oklch(0.72 0.17 20)",  accD: "oklch(0.42 0.13 20)",  text: "oklch(0.18 0.04 20)"  },
  cyan:    { acc: "oklch(0.78 0.12 220)", accD: "oklch(0.42 0.10 220)", text: "oklch(0.18 0.04 220)" },
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const agents = React.useMemo(() => buildFleet(t.fleet), [t.fleet]);
  const history = React.useMemo(() => buildHistory(agents), [agents]);

  const [selectedId, setSelectedId] = React.useState(agents[0].id);
  const [tab, setTab] = React.useState(t.openOnLoad || "summon");
  const [query, setQuery] = React.useState("");
  const [skillFilter, setSkillFilter] = React.useState(null);
  const [groupBy, setGroupBy] = React.useState("status");
  const [view, setView] = React.useState(t.view);
  const [activityOpen, setActivityOpen] = React.useState(true);
  const [wizardOpen, setWizardOpen] = React.useState(false);

  // Live runs (PIP strip + active streaming on selected)
  const [runs, setRuns] = React.useState(() => {
    // synthesize a few in-flight runs
    const working = agents.filter(a => a.status === "working").slice(0, 3);
    return working.map((a, i) => ({
      id: a.id + "-live-" + i,
      agentId: a.id,
      agentName: a.name,
      ts: Date.now() - ([62, 218, 444][i] || 60) * 1000,
      prompt: SAMPLE_PROMPTS[i + 2],
      status: "running",
      streamCount: [3, 7, 11][i] || 5,
      tokensIn: [1240, 4420, 9100][i] || 2000,
      tokensOut: [320, 980, 2310][i] || 600,
      cost: [0.12, 0.43, 0.97][i] || 0.2,
      elapsedStr: ["1m 02s","3m 38s","7m 24s"][i] || "30s",
      model: a.model,
      effort: a.effort,
    }));
  });

  // Animate stream cursor on selected agent's run
  React.useEffect(() => {
    const id = setInterval(() => {
      setRuns(rs => rs.map(r => r.status !== "running" ? r : ({
        ...r,
        streamCount: Math.min((r.streamCount || 0) + 1, STREAM_LINES.length),
        tokensOut: r.tokensOut + Math.floor(20 + Math.random()*40),
      })));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => { setView(t.view); }, [t.view]);

  // Apply accent palette via CSS variables
  React.useEffect(() => {
    const p = ACCENT_PALETTES[t.accent] || ACCENT_PALETTES.jade;
    document.documentElement.style.setProperty("--acc", p.acc);
    document.documentElement.style.setProperty("--acc-d", p.accD);
    document.documentElement.style.setProperty("--acc-faint", `color-mix(in oklch, ${p.acc} 14%, transparent)`);
    // status "done" follows accent if jade
    if (t.accent === "jade") document.documentElement.style.setProperty("--done", p.acc);
    else document.documentElement.style.setProperty("--done", "oklch(0.78 0.13 168)");
  }, [t.accent]);

  // ⌘K to focus search
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.querySelector(".search input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = agents.find(a => a.id === selectedId) || agents[0];
  const selectedRun = runs.find(r => r.agentId === selected.id) || (history[selected.id]?.[0] && {
    ...history[selected.id][0],
    streamCount: STREAM_LINES.length,
    elapsedStr: fmtDur(history[selected.id][0].durMs),
  });

  const activity = React.useMemo(() => {
    // merge live runs + recent history
    const live = runs.map(r => ({ ...r, glyph: agents.find(a => a.id === r.agentId)?.glyph }));
    const recent = [];
    Object.values(history).forEach(rs => rs.slice(0, 2).forEach(r => recent.push(r)));
    recent.sort((a,b) => b.ts - a.ts);
    return [...live, ...recent].slice(0, 60);
  }, [runs, history, agents]);

  const runningCount = runs.filter(r => r.status === "running").length;

  function onSummon(opts) {
    const id = selected.id + "-live-" + Date.now();
    setRuns(rs => [
      { id,
        agentId: selected.id, agentName: selected.name,
        ts: Date.now(), prompt: opts.prompt, status: "running",
        streamCount: 1, tokensIn: 240, tokensOut: 0, cost: 0.01,
        elapsedStr: "0s", model: opts.model, effort: opts.effort,
      },
      ...rs,
    ]);
  }
  function onAbort() {
    setRuns(rs => rs.map(r => r.agentId === selected.id ? { ...r, status: "done" } : r));
  }

  function onCreate(data) {
    setWizardOpen(false);
  }

  return (
    <div className="app" data-density={t.density}>
      <Topbar
        runningCount={runningCount}
        activityOpen={activityOpen}
        onToggleActivity={() => setActivityOpen(v => !v)}
        onCreate={() => setWizardOpen(true)}
      />

      <div className={"app-body " + (activityOpen ? "with-activity" : "")}>
        <Sidebar
          agents={agents}
          history={history}
          selectedId={selectedId}
          onSelect={setSelectedId}
          query={query} setQuery={setQuery}
          skillFilter={skillFilter} setSkillFilter={setSkillFilter}
          groupBy={groupBy} setGroupBy={setGroupBy}
          view={view} setView={setView}
          avatarStyle={t.avatar}
          onCreate={() => setWizardOpen(true)}
        />

        <main className="main">
          {view === "floor" ? (
            <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
              <FloorHeader runningCount={runningCount} totalAgents={agents.length} />
              <FloorPlan agents={agents} selectedId={selectedId} onSelect={setSelectedId} avatarStyle={t.avatar} />
            </div>
          ) : view === "grid" ? (
            <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
              <FloorHeader runningCount={runningCount} totalAgents={agents.length} title="Fleet — Grid" />
              <GridView agents={agents} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setView("list"); }} avatarStyle={t.avatar} history={history} />
            </div>
          ) : (
            <>
              <AgentHeader
                agent={selected}
                avatarStyle={t.avatar}
                runningCount={runningCount}
                onAbort={onAbort}
              />
              <Tabs active={tab} onChange={setTab} history={history[selected.id] || []} />
              <div className="tab-body scroll">
                {tab === "summon"  && <SummonPanel agent={selected} run={selectedRun} onSummon={onSummon} onAbort={onAbort} onClear={() => {}} />}
                {tab === "history" && <HistoryTab runs={history[selected.id] || []} onOpen={() => {}} />}
                {tab === "config"  && <ConfigTab agent={selected} />}
                {tab === "prompt"  && <PromptTab agent={selected} />}
              </div>
            </>
          )}
        </main>

        {activityOpen && (
          <ActivityDrawer
            items={activity}
            onClose={() => setActivityOpen(false)}
            onJump={(id) => { setSelectedId(id); setView("list"); setTab("summon"); }}
          />
        )}
      </div>

      <div className="statusbar">
        <span><span className="statusdot working" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }}></span>{runningCount} running</span>
        <span className="sep">|</span>
        <span>{agents.length} agents</span>
        <span className="sep">|</span>
        <span>$1.52 today</span>
        <span className="sep">|</span>
        {t.showPipStrip ? (
          <PipStrip
            runs={runs.filter(r => r.status === "running")}
            onJump={(id) => { setSelectedId(id); setView("list"); setTab("summon"); }}
            onDismiss={(id) => setRuns(rs => rs.filter(r => r.id !== id))}
          />
        ) : <span style={{ flex: 1 }}></span>}
        <span className="sep">|</span>
        <span>claude-code v1.4.0</span>
        <span className="sep">|</span>
        <span><span className="kbd">⌘K</span> search · <span className="kbd">⌘↵</span> summon</span>
      </div>

      {wizardOpen && <Wizard onClose={() => setWizardOpen(false)} onCreate={onCreate} />}

      <TweaksUI t={t} setTweak={setTweak} />
    </div>
  );
}

function FloorHeader({ runningCount, totalAgents, title = "Office — Floor Plan" }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 18px", borderBottom: "1px solid var(--line)",
    }}>
      <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</h1>
      <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
        {runningCount} working · {totalAgents} desks
      </div>
      <div style={{ marginLeft: "auto" }} className="row">
        <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>tap a desk to focus an agent</span>
      </div>
    </div>
  );
}

function Topbar({ runningCount, activityOpen, onToggleActivity, onCreate }) {
  return (
    <div className="topbar">
      <div className="topbar-brand">
        <div className="logo">A</div>
        Agent Office

      </div>
      <div className="topbar-spacer"></div>

      <div className="run-chip">
        <span className="pulse"></span>
        <span style={{ color: "var(--txt)" }}><b>{runningCount}</b></span>
        <span style={{ color: "var(--txt-3)" }}>running</span>
      </div>
      <button className="topbar-btn" onClick={onToggleActivity}>
        <I.Activity /> Activity
      </button>
      <button className="topbar-btn primary" onClick={onCreate}>
        <I.Plus /> New agent
      </button>
      <button className="topbar-btn" title="Settings">
        <I.Settings />
      </button>
    </div>
  );
}

function TweaksUI({ t, setTweak }) {
  return (
    <TweaksPanel>
      <TweakSection label="Look" />
      <TweakColor label="Accent" value={t.accent}
        options={["jade","amber","iris","rose","cyan"]}
        renderOption={(v) => v}
        onChange={(v) => setTweak("accent", v)}
      />
      <TweakRadio label="Density" value={t.density}
        options={["compact","regular","comfy"]}
        onChange={(v) => setTweak("density", v)} />

      <TweakSection label="Roster" />
      <TweakRadio label="View" value={t.view}
        options={["list","grid","floor"]}
        onChange={(v) => setTweak("view", v)} />
      <TweakSelect label="Avatars" value={t.avatar}
        options={["sprite","identicon","glyph","monogram"]}
        onChange={(v) => setTweak("avatar", v)} />
      <TweakSlider label="Fleet size" value={t.fleet} min={5} max={50} step={1}
        onChange={(v) => setTweak("fleet", v)} />

      <TweakSection label="Office metaphor" />
      <TweakRadio label="Intensity" value={t.metaphor}
        options={["off","icons","full"]}
        onChange={(v) => setTweak("metaphor", v)} />
      <TweakToggle label="Bottom PIP strip" value={t.showPipStrip}
        onChange={(v) => setTweak("showPipStrip", v)} />
    </TweaksPanel>
  );
}

// Custom TweakColor renderOption hook — falls back to default if undefined
// (the starter component already supports color string options; here we pass strings for accents)

ReactDOM.createRoot(document.getElementById("app")).render(<App />);
