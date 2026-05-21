// floorplan.jsx - pixel-art office: each agent is a desk on a 2D grid

function FloorPlan({ agents, selectedId, onSelect, avatarStyle }) {
  // Layout: 4 rooms (Research, Build, QA, Ops) + center "lounge"
  // We bin agents by their primary skill cluster
  const clusters = {
    Research: { name: "Research", x: 40,  y: 40,  w: 480, h: 280, skills: ["research","docs","ml","data"] },
    Build:    { name: "Build",    x: 540, y: 40,  w: 520, h: 280, skills: ["refactor","perf","devops","design"] },
    QA:       { name: "QA",       x: 40,  y: 380, w: 480, h: 300, skills: ["qa-web","qa-app","test-gen","code-review"] },
    Ops:      { name: "Ops",      x: 540, y: 380, w: 520, h: 300, skills: ["security","scraping","i18n"] },
  };

  function clusterFor(a) {
    for (const [k, v] of Object.entries(clusters)) {
      if (a.skills.some(s => v.skills.includes(s))) return k;
    }
    return "Ops";
  }

  // Distribute agents inside each room in a tidy grid
  const placed = [];
  const room = {};
  agents.forEach(a => {
    const c = clusterFor(a);
    (room[c] = room[c] || []).push(a);
  });
  Object.entries(room).forEach(([k, list]) => {
    const r = clusters[k];
    const cols = 4;
    const padX = 18, padY = 36;
    const cw = 96, ch = 72;
    const gx = (r.w - padX*2 - cols*cw) / (cols - 1);
    const gy = 28;
    list.forEach((a, i) => {
      const cx = i % cols, cy = Math.floor(i / cols);
      placed.push({
        agent: a,
        x: r.x + padX + cx * (cw + gx),
        y: r.y + padY + cy * (ch + gy),
      });
    });
  });

  return (
    <div className="floorplan scroll">
      <div className="floor-grid">
        {/* rooms */}
        {Object.values(clusters).map(r => (
          <div key={r.name} style={{
            position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h,
            border: "1px solid var(--line-strong)",
            borderRadius: 2,
            background: "color-mix(in oklch, var(--bg-2) 50%, transparent)",
          }}>
            <div className="room-label" style={{ left: 8, top: 6 }}>{r.name}</div>
          </div>
        ))}
        {/* lounge / coffee */}
        <div style={{
          position: "absolute", left: 488, top: 326, width: 124, height: 36,
          background: "var(--bg-3)",
          border: "1px solid var(--line-strong)",
          borderRadius: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, color: "var(--txt-3)", fontFamily: "var(--mono)", fontSize: 9,
          textTransform: "uppercase", letterSpacing: "0.1em",
        }}>
          <I.Coffee /> Lounge
        </div>

        {/* desks */}
        {placed.map(({ agent, x, y }) => (
          <div key={agent.id}
            className={"desk " + agent.status + (selectedId === agent.id ? " selected" : "")}
            style={{ left: x, top: y }}
            onClick={() => onSelect(agent.id)}
            title={agent.name + " - " + agent.status}>
            <div className="desk-top">
              <span className={"statusdot " + agent.status}></span>
              <span style={{ color: "var(--txt-2)", fontSize: 8 }}>{agent.id.slice(0,6)}</span>
            </div>
            <div className="desk-body">
              <Avatar agent={agent} style={avatarStyle} size={28} />
              <div className="lbl">
                <div style={{ fontSize: 10, fontWeight: 600 }}>{agent.name}</div>
                <div style={{ fontSize: 8, color: "var(--txt-3)", marginTop: 1 }}>{agent.skills[0]}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Grid view: bigger tiles
function GridView({ agents, selectedId, onSelect, avatarStyle, history }) {
  return (
    <div className="scroll" style={{
      overflow: "auto", padding: 18, height: "100%",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
      gap: 12, alignContent: "start",
    }}>
      {agents.map(a => {
        const runs = history[a.id] || [];
        const last = runs[0];
        return (
          <div key={a.id}
            onClick={() => onSelect(a.id)}
            style={{
              background: selectedId === a.id ? "var(--bg-2)" : "var(--bg-1)",
              border: "1px solid " + (selectedId === a.id ? "var(--line-strong)" : "var(--line)"),
              borderRadius: 8, padding: 14, cursor: "pointer",
              display: "flex", flexDirection: "column", gap: 8,
              minHeight: 124,
            }}>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div style={{ position: "relative" }}>
                <Avatar agent={a} style={avatarStyle} size={36} />
                <div className={"statusdot " + a.status} style={{
                  position: "absolute", right: -2, bottom: -2,
                  border: "2px solid var(--bg-1)", width: 10, height: 10,
                }}></div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 2 }}>
                  {a.model} · {a.effort}
                </div>
              </div>
              <Sparkline data={sparkFor(a.id)} color="var(--txt-3)" />
            </div>
            <div style={{
              fontSize: 12, color: "var(--txt-2)", lineHeight: 1.4,
              display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden",
            }}>
              {a.desc}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "auto" }}>
              {a.skills.slice(0,3).map(s => <span key={s} className="tag skill">#{s}</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { FloorPlan, GridView });
