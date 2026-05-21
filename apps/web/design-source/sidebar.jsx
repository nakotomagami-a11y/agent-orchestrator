// sidebar.jsx - left roster: search, filters, group-by, dense rows

function Sidebar({
  agents, history, selectedId, onSelect,
  query, setQuery,
  skillFilter, setSkillFilter,
  groupBy, setGroupBy,
  view, setView,
  avatarStyle,
  onCreate,
}) {
  const skillCounts = React.useMemo(() => {
    const m = {};
    agents.forEach(a => a.skills.forEach(s => { m[s] = (m[s]||0) + 1; }));
    return m;
  }, [agents]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter(a => {
      if (skillFilter && !a.skills.includes(skillFilter)) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.desc.toLowerCase().includes(q) ||
        a.skills.some(s => s.toLowerCase().includes(q)) ||
        a.tools.some(t => t.toLowerCase().includes(q))
      );
    });
  }, [agents, query, skillFilter]);

  const groups = React.useMemo(() => {
    if (groupBy === "none") return [["All", filtered]];
    if (groupBy === "status") {
      const order = ["working","queued","error","done","idle"];
      const m = {};
      order.forEach(k => m[k] = []);
      filtered.forEach(a => (m[a.status] || (m[a.status]=[])).push(a));
      return order.filter(k => m[k] && m[k].length).map(k => [k, m[k]]);
    }
    if (groupBy === "skill") {
      const m = {};
      filtered.forEach(a => {
        const s = a.skills[0] || "other";
        (m[s] || (m[s] = [])).push(a);
      });
      return Object.entries(m).sort((a,b) => b[1].length - a[1].length);
    }
    if (groupBy === "model") {
      const order = ["opus","sonnet","haiku"];
      const m = {};
      filtered.forEach(a => (m[a.model] || (m[a.model]=[])).push(a));
      return order.filter(k => m[k]).map(k => [k, m[k]]);
    }
    return [["All", filtered]];
  }, [filtered, groupBy]);

  const topSkills = Object.entries(skillCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="search">
          <I.Search />
          <input
            placeholder="Search agents, skills, tools…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <span className="kbd">⌘K</span>
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="viewseg">
            <button className={view === "list" ? "on" : ""} onClick={() => setView("list")} title="List view"><I.List /></button>
            <button className={view === "grid" ? "on" : ""} onClick={() => setView("grid")} title="Grid view"><I.Grid /></button>
            <button className={view === "floor" ? "on" : ""} onClick={() => setView("floor")} title="Floor plan"><I.Floor /></button>
          </div>
          <button className="topbar-btn" style={{ height: 28, padding: "0 8px" }} onClick={onCreate} title="New agent">
            <I.Plus /> <span style={{ fontSize: 11.5 }}>New</span>
          </button>
        </div>
        <div className="skill-row">
          <button className={"chip " + (skillFilter === null ? "on" : "")}
            onClick={() => setSkillFilter(null)}>
            all <span className="n">{agents.length}</span>
          </button>
          {topSkills.map(([s, n]) => (
            <button key={s}
              className={"chip " + (skillFilter === s ? "on" : "")}
              onClick={() => setSkillFilter(skillFilter === s ? null : s)}>
              {s} <span className="n">{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-tabs">
        {["none","status","skill","model"].map(k => (
          <button key={k} className={groupBy === k ? "on" : ""} onClick={() => setGroupBy(k)}>
            {k === "none" ? "Flat" : "by " + k}
          </button>
        ))}
      </div>

      <div className="roster scroll">
        {groups.map(([label, list]) => (
          <div key={label}>
            {groupBy !== "none" && (
              <div className="roster-group">
                <span>{label}</span>
                <span className="line"></span>
                <span>{list.length}</span>
              </div>
            )}
            {list.map(a => (
              <AgentRow key={a.id} agent={a}
                history={history[a.id] || []}
                selected={selectedId === a.id}
                onSelect={() => onSelect(a.id)}
                avatarStyle={avatarStyle}
              />
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--txt-3)", fontSize: 12 }}>
            No agents match
          </div>
        )}
      </div>
    </aside>
  );
}

function AgentRow({ agent, history, selected, onSelect, avatarStyle }) {
  const runs = history.length;
  const lastRun = history[0];
  const spark = sparkFor(agent.id);
  return (
    <div className={"agent-row " + (selected ? "selected" : "")} onClick={onSelect}>
      <div className="id-col">
        <Avatar agent={agent} style={avatarStyle} size={28} />
        <div className={"statusdot " + agent.status} style={{
          position: "absolute", right: -2, bottom: -2,
          border: "2px solid var(--bg-0)", width: 10, height: 10,
        }}></div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="name">
          {agent.name}
          {agent.status === "working" && <span style={{
            fontFamily: "var(--mono)", fontSize: 10, color: "var(--working)",
            textTransform: "uppercase", letterSpacing: "0.06em"
          }}>· running</span>}
        </div>
        <div className="meta">
          {agent.skills.slice(0,2).map(s => <span key={s} className="skill">{s}</span>)}
          <span style={{ color: "var(--line-strong)" }}>·</span>
          <span>{agent.model}</span>
        </div>
      </div>
      <div className="right">
        <Sparkline data={spark} />
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, AgentRow });
