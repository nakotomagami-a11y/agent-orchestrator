// v3/iso-office.jsx — isometric pixel-art office room

function IsoOffice({ agents, selectedId, onSelect, gamified = true, zoom = 1 }) {
  if (!gamified) {
    return <CardsOffice agents={agents} selectedId={selectedId} onSelect={onSelect} />;
  }
  return <IsoRoom agents={agents} selectedId={selectedId} onSelect={onSelect} zoom={zoom} />;
}

// Non-gamified: clean Yaru card grid
function CardsOffice({ agents, selectedId, onSelect }) {
  return (
    <div className="cards-office">
      {agents.map(a => (
        <div key={a.id}
          className={"desk-card " + (selectedId === a.id ? "selected" : "")}
          onClick={() => onSelect(a.id)}>
          <div className="dc-h">
            <div className="av"><PxSprite agent={a} size={40} action={a.status === "working" ? "typing" : "idle"} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="dc-name">{a.name}</div>
              <div className="dc-id">{a.id}</div>
            </div>
            <span className={"roster-row".split(" ")[0]} style={{ position: "static" }}></span>
            <StatusDot status={a.status} />
          </div>
          <div className="dc-task" title={a.task || "Idle — ready when you are"}>
            {a.task || "Idle — ready when you are"}
          </div>
          <div className="dc-meta">
            <span>{a.model} · {a.effort}</span>
            <span>{a.skills.map(s => "#"+s).join(" ")}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusDot({ status }) {
  const map = {
    working: { c: "var(--working)", anim: true, label: "working" },
    thinking:{ c: "var(--thinking)", anim: true, label: "thinking" },
    done:    { c: "var(--done)", anim: false, label: "done" },
    queued:  { c: "var(--queued)", anim: false, label: "queued" },
    error:   { c: "var(--error)", anim: false, label: "error" },
    idle:    { c: "var(--idle)", anim: false, label: "idle" },
  };
  const s = map[status] || map.idle;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10.5, color: "var(--txt-3)", fontFamily: "var(--font-mono)",
      textTransform: "uppercase", letterSpacing: "0.04em",
    }}>
      <span style={{
        display: "inline-block", width: 8, height: 8, borderRadius: 50,
        background: s.c,
        boxShadow: s.anim ? `0 0 0 3px ${s.c}33` : "none",
        animation: s.anim ? "pulseDot 1.8s infinite" : "none",
      }} />
      {s.label}
    </span>
  );
}

// ── Isometric Room ──
// Coordinate system: tile is 64w x 32h. We grid 8x6 tiles.
const TW = 64, TH = 32;
const COLS = 9, ROWS = 8;

function isoXY(col, row) {
  return {
    x: (col - row) * (TW / 2),
    y: (col + row) * (TH / 2),
  };
}

function IsoRoom({ agents, selectedId, onSelect, zoom }) {
  // Stage size
  const stageW = (COLS + ROWS) * (TW / 2) + 80;
  const stageH = (COLS + ROWS) * (TH / 2) + 240;
  const offsetX = (ROWS - 1) * (TW / 2) + 40;
  const offsetY = 40;

  // Desk positions: 4 desks per tier, 4 tiers
  // tier 0: front, tier 1: 2nd row, etc.
  // each tier at rows 5,4,3,2 and cols 1,3,5,7
  function deskPos(tier, slot) {
    const row = 5 - tier;
    const col = 1 + slot * 2;
    const { x, y } = isoXY(col, row);
    return { x: x + offsetX, y: y + offsetY };
  }

  return (
    <div className="office-canvas">
      <div className="iso-stage" style={{
        width: stageW, height: stageH,
        transform: `scale(${zoom})`,
      }}>
        <FloorSVG offsetX={offsetX} offsetY={offsetY} />

        {/* Decorations: plants, water cooler, whiteboard */}
        <Decor offsetX={offsetX} offsetY={offsetY} />

        {/* Desks + agents */}
        {agents.map(a => {
          const pos = deskPos(a.desk.tier, a.desk.slot);
          return (
            <DeskWithAgent
              key={a.id}
              agent={a}
              x={pos.x - 48}
              y={pos.y - 40}
              selected={selectedId === a.id}
              onClick={() => onSelect(a.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function FloorSVG({ offsetX, offsetY }) {
  // Draw a diamond grid of floor tiles
  const tiles = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { x, y } = isoXY(c, r);
      const alt = (c + r) % 2 === 0;
      tiles.push({
        x: x + offsetX, y: y + offsetY, alt,
      });
    }
  }
  const stageW = (COLS + ROWS) * (TW / 2) + 80;
  const stageH = (COLS + ROWS) * (TH / 2) + 240;
  return (
    <svg className="iso-floor-svg" width={stageW} height={stageH}
      style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <linearGradient id="wallGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#EFE2D6" />
          <stop offset="1" stopColor="#E1D0C0" />
        </linearGradient>
        <linearGradient id="wallShade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#D8C0AA" />
          <stop offset="1" stopColor="#C8AE96" />
        </linearGradient>
      </defs>

      {/* Back walls — two trapezoids meeting at top */}
      {/* Left wall (along row=0 edge) */}
      <polygon
        points={
          `${isoXY(0,0).x+offsetX},${isoXY(0,0).y+offsetY}
           ${isoXY(COLS,0).x+offsetX},${isoXY(COLS,0).y+offsetY}
           ${isoXY(COLS,0).x+offsetX},${isoXY(COLS,0).y+offsetY-120}
           ${isoXY(0,0).x+offsetX},${isoXY(0,0).y+offsetY-120}`
        }
        fill="url(#wallGrad)" stroke="#C8AE96" strokeWidth="1"
      />
      {/* Right wall (along col=COLS edge) */}
      <polygon
        points={
          `${isoXY(COLS,0).x+offsetX},${isoXY(COLS,0).y+offsetY}
           ${isoXY(COLS,ROWS).x+offsetX},${isoXY(COLS,ROWS).y+offsetY}
           ${isoXY(COLS,ROWS).x+offsetX},${isoXY(COLS,ROWS).y+offsetY-120}
           ${isoXY(COLS,0).x+offsetX},${isoXY(COLS,0).y+offsetY-120}`
        }
        fill="url(#wallShade)" stroke="#B89A80" strokeWidth="1"
      />

      {/* Window panels on back-left wall */}
      {[1,3,5].map(i => {
        const a = isoXY(i, 0); const b = isoXY(i+1.5, 0);
        return (
          <g key={i}>
            <rect
              x={a.x + offsetX + 4}
              y={a.y + offsetY - 90}
              width={(b.x - a.x) - 8}
              height={50}
              fill="#B3D9E8" stroke="#A0C0D0"
            />
            <line
              x1={a.x + offsetX + (b.x-a.x)/2} y1={a.y + offsetY - 90}
              x2={a.x + offsetX + (b.x-a.x)/2} y2={a.y + offsetY - 40}
              stroke="#A0C0D0"
            />
          </g>
        );
      })}

      {/* Floor tiles */}
      {tiles.map((t, i) => (
        <polygon
          key={i}
          points={
            `${t.x},${t.y}
             ${t.x+TW/2},${t.y+TH/2}
             ${t.x},${t.y+TH}
             ${t.x-TW/2},${t.y+TH/2}`
          }
          fill={t.alt ? "#D4BFA6" : "#C9B097"}
          stroke="#B89A80" strokeWidth="0.5"
        />
      ))}
    </svg>
  );
}

function Decor({ offsetX, offsetY }) {
  // A coffee bar + whiteboard at back, water cooler corner
  const wb = isoXY(2, 0);
  const cb = isoXY(6, 0);
  return (
    <>
      {/* Whiteboard on left wall */}
      <div style={{
        position: "absolute",
        left: wb.x + offsetX - 30, top: wb.y + offsetY - 65,
        width: 80, height: 36,
        background: "#F8F4EE", border: "2px solid #2C001E",
        boxShadow: "2px 2px 0 rgba(0,0,0,0.15)",
        fontFamily: "var(--font-mono)", fontSize: 7,
        padding: 4, color: "#2C001E",
        lineHeight: 1.1, overflow: "hidden",
      }}>
        SPRINT 24<br/>· ship checkout<br/>· a11y pass<br/>· perf budget
      </div>

      {/* Coffee bar */}
      <div style={{
        position: "absolute",
        left: cb.x + offsetX - 20, top: cb.y + offsetY - 30,
        width: 60, height: 30,
        background: "#77216F",
        borderTop: "3px solid #5e1858",
      }}>
        <div style={{
          position: "absolute", left: 8, top: -10,
          width: 10, height: 14, background: "#1E1A18",
          borderTop: "2px solid #E95420",
        }}></div>
        <div style={{
          position: "absolute", left: 28, top: -8,
          width: 12, height: 12, background: "#E95420", borderRadius: 2,
        }}></div>
      </div>

      {/* Plant in corner */}
      <div style={{
        position: "absolute",
        left: isoXY(COLS-1, ROWS-1).x + offsetX - 14, top: isoXY(COLS-1, ROWS-1).y + offsetY - 32,
        width: 28, height: 36,
      }}>
        <div style={{ position: "absolute", left: 8, top: 22, width: 12, height: 12,
          background: "#8B5A3C", borderRadius: 2 }}></div>
        <div style={{ position: "absolute", left: 0, top: 0, width: 28, height: 26,
          background: "radial-gradient(ellipse at 50% 60%, #2C8B3E 50%, transparent 60%)" }}></div>
        <div style={{ position: "absolute", left: 6, top: 6, width: 4, height: 8,
          background: "#3CB04A", borderRadius: 2, transform: "rotate(-20deg)" }}></div>
        <div style={{ position: "absolute", left: 18, top: 4, width: 4, height: 10,
          background: "#3CB04A", borderRadius: 2, transform: "rotate(20deg)" }}></div>
      </div>
    </>
  );
}

function DeskWithAgent({ agent, x, y, selected, onClick }) {
  const isWorking = agent.status === "working" || agent.status === "thinking";
  return (
    <div className={"desk " + (selected ? "selected" : "")}
      style={{ left: x, top: y }}
      onClick={onClick}>
      {/* speech bubble */}
      {isWorking && agent.task && (
        <div className={"bubble " + agent.status}>
          <span className="dot"></span>
          <span>{agent.task.length > 22 ? agent.task.slice(0, 22) + "…" : agent.task}</span>
        </div>
      )}
      {!isWorking && agent.status === "done" && agent.task && (
        <div className="bubble done">
          <span className="dot"></span>
          <span>✓ {agent.taskKind || "done"}</span>
        </div>
      )}

      {/* desk svg */}
      <svg width="96" height="96" viewBox="0 0 96 96" style={{ position: "absolute", left: 0, top: 8 }}>
        {/* Desk top (isometric rhombus) */}
        <polygon points="48,30 86,49 48,68 10,49" fill="#5E4632" stroke="#3a2a1d" strokeWidth="1" />
        <polygon points="48,30 86,49 48,68 10,49" fill="#7A5A40" opacity="0.4" />
        {/* Desk legs */}
        <rect x="14" y="49" width="2" height="22" fill="#3a2a1d" />
        <rect x="80" y="49" width="2" height="22" fill="#3a2a1d" />
        <rect x="46" y="65" width="2" height="22" fill="#3a2a1d" />

        {/* Monitor */}
        <g transform={agent.desk.monitor >= 2 ? "translate(-10, 0)" : ""}>
          <polygon points="48,16 64,24 48,32 32,24" fill="#1E1A18" />
          <polygon points="48,18 62,24 48,30 34,24" fill={isWorking ? "#2C001E" : "#3a3530"} />
          {isWorking && (
            <>
              <rect x="38" y="22" width="20" height="1" fill="#E95420" opacity="0.8" />
              <rect x="38" y="25" width="14" height="1" fill="#F5814C" opacity="0.6" />
              <rect x="38" y="27" width="17" height="1" fill="#E95420" opacity="0.5" />
            </>
          )}
        </g>
        {agent.desk.monitor >= 2 && (
          <g transform="translate(14, 0)">
            <polygon points="48,16 64,24 48,32 32,24" fill="#1E1A18" />
            <polygon points="48,18 62,24 48,30 34,24" fill={isWorking ? "#2C001E" : "#3a3530"} />
            {isWorking && <rect x="38" y="22" width="20" height="6" fill="#0E8420" opacity="0.5" />}
          </g>
        )}

        {/* Plant on desk */}
        {agent.desk.plant && (
          <g transform="translate(70, 36)">
            <rect x="0" y="6" width="6" height="6" fill="#8B5A3C" />
            <ellipse cx="3" cy="4" rx="5" ry="4" fill="#2C8B3E" />
            <ellipse cx="0" cy="2" rx="2" ry="3" fill="#3CB04A" />
          </g>
        )}

        {/* Keyboard hint */}
        <rect x="40" y="50" width="16" height="3" fill="#1E1A18" opacity="0.6" />
      </svg>

      {/* Agent sprite — positioned behind/beside desk */}
      <div style={{
        position: "absolute",
        left: 30, top: -16,
        width: 36, height: 48,
        pointerEvents: "none",
      }}>
        <PxSprite agent={agent} size={36}
          action={agent.status === "working" ? "typing" : "idle"} />
      </div>

      <div className="desk-name">{agent.short}</div>
    </div>
  );
}

Object.assign(window, { IsoOffice, IsoRoom, CardsOffice, StatusDot });
