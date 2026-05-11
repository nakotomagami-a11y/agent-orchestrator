// v3/iso-office.jsx — TOP-DOWN PIXEL OFFICE (replaces iso projection)

function IsoOffice({ agents, selectedId, onSelect, gamified = true, zoom = 1 }) {
  if (!gamified) return <CardsOffice agents={agents} selectedId={selectedId} onSelect={onSelect} />;
  return <TopDownOffice agents={agents} selectedId={selectedId} onSelect={onSelect} zoom={zoom} />;
}

// Non-gamified card grid (unchanged)
function CardsOffice({ agents, selectedId, onSelect }) {
  return (
    <div className="cards-office">
      {agents.map(a => (
        <div key={a.id} className={"desk-card " + (selectedId === a.id ? "selected" : "")} onClick={() => onSelect(a.id)}>
          <div className="dc-h">
            <div className="av"><PxSprite agent={a} size={40} action={a.status === "working" ? "typing" : "idle"} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="dc-name">{a.name}</div>
              <div className="dc-id">{a.id}</div>
            </div>
            <StatusDot status={a.status} />
          </div>
          <div className="dc-task">{a.task || "Idle — ready when you are"}</div>
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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--txt-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 50, background: s.c, boxShadow: s.anim ? `0 0 0 3px ${s.c}33` : "none", animation: s.anim ? "pulseDot 1.8s infinite" : "none" }} />
      {s.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TOP-DOWN PIXEL OFFICE
// ═══════════════════════════════════════════════════════════════════════

const ROOM_W = 1040;
const ROOM_H = 720;

// 16 workstations in 4 pinwheel pods (4 agents each), arranged in 2x2 grid
// pod center coordinates
const PODS = [
  { cx: 250, cy: 380 },   // Pod A — top-left
  { cx: 720, cy: 380 },   // Pod B — top-right (under coffee)
  { cx: 250, cy: 580 },   // Pod C — bottom-left
  { cx: 720, cy: 580 },   // Pod D — bottom-right
];

// Each agent gets a (pod, side) position. 4 sides: N, E, S, W (pinwheel)
function agentSeat(agent) {
  const podIdx = agent.desk.tier;          // reuse tier as pod index (0-3)
  const side   = agent.desk.slot;          // 0=N 1=E 2=S 3=W
  const pod = PODS[podIdx % 4];
  return { pod, side };
}

function TopDownOffice({ agents, selectedId, onSelect, zoom }) {
  return (
    <div className="office-canvas">
      <div className="topdown-stage" style={{
        width: ROOM_W, height: ROOM_H,
        transform: `scale(${zoom})`,
        position: "relative",
        imageRendering: "pixelated",
      }}>
        <FloorPlan />
        <MeetingRoom />
        <CoffeeCorner />
        <PlantStrips />

        {/* Cubicle pods (walls + central dividers) */}
        {PODS.map((p, i) => <CubiclePod key={i} cx={p.cx} cy={p.cy} />)}

        {/* Workstations + agents */}
        {agents.map(a => {
          const { pod, side } = agentSeat(a);
          return (
            <Workstation
              key={a.id}
              agent={a}
              cx={pod.cx} cy={pod.cy}
              side={side}
              selected={selectedId === a.id}
              onClick={() => onSelect(a.id)}
            />
          );
        })}

        {/* Scattered details */}
        <Details />
      </div>
    </div>
  );
}

// ── Floor plan: outer walls + carpet ──
function FloorPlan() {
  // Floor: warm carpet with subtle grid pixels
  return (
    <svg width={ROOM_W} height={ROOM_H} style={{ position: "absolute", inset: 0 }} shapeRendering="crispEdges">
      <defs>
        <pattern id="carpet" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#d4c0a8" />
          <rect width="8" height="8" fill="#c9b097" />
          <rect x="8" y="8" width="8" height="8" fill="#c9b097" />
          <rect x="0" y="0" width="1" height="16" fill="#b89a80" opacity="0.4" />
          <rect x="0" y="0" width="16" height="1" fill="#b89a80" opacity="0.4" />
        </pattern>
        <pattern id="wallTex" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#5e5145" />
          <rect width="8" height="1" fill="#3a3128" />
          <rect width="1" height="8" fill="#3a3128" />
          <rect x="4" y="3" width="1" height="1" fill="#7a6b5c" />
        </pattern>
      </defs>
      <rect width={ROOM_W} height={ROOM_H} fill="url(#carpet)" />
      {/* Outer wall — thick perimeter */}
      <rect x="0" y="0" width={ROOM_W} height="14" fill="url(#wallTex)" />
      <rect x="0" y={ROOM_H - 14} width={ROOM_W} height="14" fill="url(#wallTex)" />
      <rect x="0" y="0" width="14" height={ROOM_H} fill="url(#wallTex)" />
      <rect x={ROOM_W - 14} y="0" width="14" height={ROOM_H} fill="url(#wallTex)" />
      {/* Wall trim highlight */}
      <rect x="0" y="14" width={ROOM_W} height="2" fill="#2a2018" />
      <rect x="0" y={ROOM_H - 16} width={ROOM_W} height="2" fill="#2a2018" />
      <rect x="14" y="0" width="2" height={ROOM_H} fill="#2a2018" />
      <rect x={ROOM_W - 16} y="0" width="2" height={ROOM_H} fill="#2a2018" />
    </svg>
  );
}

// ── Meeting room (top-left area) ──
function MeetingRoom() {
  const x = 60, y = 40, w = 540, h = 200;
  return (
    <svg width={ROOM_W} height={ROOM_H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} shapeRendering="crispEdges">
      {/* room walls — three sides, open at bottom */}
      <rect x={x} y={y} width={w} height="6" fill="#5e5145" />
      <rect x={x} y={y} width="6" height={h} fill="#5e5145" />
      <rect x={x+w-6} y={y} width="6" height={h} fill="#5e5145" />
      {/* shadow lip */}
      <rect x={x} y={y+6} width={w} height="2" fill="#3a3128" />
      <rect x={x+6} y={y} width="2" height={h} fill="#3a3128" />
      <rect x={x+w-8} y={y} width="2" height={h} fill="#3a3128" />

      {/* opening (door gap on bottom) */}
      <rect x={x+w/2-32} y={y+h-6} width="64" height="6" fill="#5e5145" opacity="0.0" />

      {/* Floor tint inside */}
      <rect x={x+8} y={y+8} width={w-16} height={h-16} fill="#e2d3bd" opacity="0.4" />

      {/* Windows on top wall */}
      {[140, 260, 380, 500].map(wx => (
        <g key={wx}>
          <rect x={wx} y={y-1} width="60" height="8" fill="#A0C4D8" />
          <rect x={wx} y={y-1} width="60" height="2" fill="#7BA0B8" />
          <rect x={wx+29} y={y-1} width="2" height="8" fill="#7BA0B8" />
        </g>
      ))}

      {/* Conference table — pixel-art wood */}
      <g transform={`translate(${x+w/2-100},${y+58})`}>
        <rect x="0" y="0" width="200" height="80" fill="#8B5A3C" />
        <rect x="0" y="0" width="200" height="3" fill="#A57244" />
        <rect x="0" y="77" width="200" height="3" fill="#5d3a23" />
        <rect x="0" y="0" width="3" height="80" fill="#A57244" />
        <rect x="197" y="0" width="3" height="80" fill="#5d3a23" />
        {/* table seam */}
        <rect x="98" y="0" width="2" height="80" fill="#5d3a23" opacity="0.5" />
        {/* laptop on table */}
        <rect x="85" y="32" width="30" height="18" fill="#1E1A18" />
        <rect x="87" y="34" width="26" height="14" fill="#E95420" opacity="0.7" />
        <rect x="87" y="34" width="26" height="2" fill="#F5814C" />
        {/* coffee cups */}
        <circle cx="40" cy="20" r="5" fill="#fff" />
        <circle cx="40" cy="20" r="3" fill="#3a2510" />
        <circle cx="160" cy="60" r="5" fill="#fff" />
        <circle cx="160" cy="60" r="3" fill="#3a2510" />
        {/* paper */}
        <rect x="135" y="14" width="14" height="18" fill="#f4efe8" />
        <rect x="137" y="17" width="10" height="1" fill="#999" />
        <rect x="137" y="20" width="10" height="1" fill="#999" />
        <rect x="137" y="23" width="6" height="1" fill="#999" />
      </g>

      {/* chairs around table — top side */}
      {[80, 160, 240, 320, 400].map(cx => <PixChair key={"t"+cx} x={x+cx} y={y+30} dir="N" color="#C7162B" />)}
      {/* bottom side */}
      {[80, 160, 240, 320, 400].map(cx => <PixChair key={"b"+cx} x={x+cx} y={y+150} dir="S" color="#C7162B" />)}
      {/* head + foot */}
      <PixChair x={x+30} y={y+90} dir="W" color="#C7162B" />
      <PixChair x={x+w-50} y={y+90} dir="E" color="#C7162B" />

      {/* "MEETING ROOM" label on door */}
      <g transform={`translate(${x+w/2-50},${y+h-22})`}>
        <rect x="0" y="0" width="100" height="14" fill="#2C001E" />
        <rect x="0" y="0" width="100" height="2" fill="#4a1f3c" />
        <text x="50" y="10" fontFamily="Ubuntu Sans Mono, monospace" fontSize="9" fill="#F5814C" textAnchor="middle" fontWeight="700" letterSpacing="0.1em">MEETING</text>
      </g>
    </svg>
  );
}

// ── Coffee / lounge corner ──
function CoffeeCorner() {
  const x = 640, y = 40, w = 360, h = 200;
  return (
    <svg width={ROOM_W} height={ROOM_H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} shapeRendering="crispEdges">
      {/* room walls (3 sides) */}
      <rect x={x} y={y} width={w} height="6" fill="#5e5145" />
      <rect x={x} y={y} width="6" height={h} fill="#5e5145" />
      <rect x={x+w-6} y={y} width="6" height={h} fill="#5e5145" />
      <rect x={x} y={y+6} width={w} height="2" fill="#3a3128" />
      <rect x={x+6} y={y} width="2" height={h} fill="#3a3128" />
      <rect x={x+w-8} y={y} width="2" height={h} fill="#3a3128" />

      {/* darker floor tint */}
      <rect x={x+8} y={y+8} width={w-16} height={h-16} fill="#a07a5a" opacity="0.18" />

      {/* Window */}
      <rect x={x+w-1} y={y+30} width="8" height="80" fill="#A0C4D8" />
      <rect x={x+w-1} y={y+30} width="2" height="80" fill="#7BA0B8" />
      <rect x={x+w-1} y={y+68} width="8" height="2" fill="#7BA0B8" />

      {/* Kitchen counter (top wall) */}
      <rect x={x+20} y={y+20} width="200" height="34" fill="#8a8079" />
      <rect x={x+20} y={y+20} width="200" height="3" fill="#b3a99f" />
      <rect x={x+20} y={y+51} width="200" height="3" fill="#5e5651" />
      {/* coffee machine */}
      <rect x={x+40} y={y+10} width="22" height="22" fill="#2C001E" />
      <rect x={x+42} y={y+12} width="18" height="6" fill="#E95420" />
      <rect x={x+48} y={y+22} width="6" height="4" fill="#1E1A18" />
      {/* sink */}
      <rect x={x+80} y={y+24} width="34" height="22" fill="#2a2522" />
      <rect x={x+82} y={y+26} width="30" height="18" fill="#5e5651" />
      <rect x={x+95} y={y+18} width="3" height="8" fill="#b3a99f" />
      {/* fridge */}
      <rect x={x+170} y={y+10} width="40" height="46" fill="#f4efe8" />
      <rect x={x+170} y={y+10} width="40" height="2" fill="#c7bfb7" />
      <rect x={x+170} y={y+34} width="40" height="2" fill="#c7bfb7" />
      <rect x={x+203} y={y+18} width="2" height="6" fill="#8a8079" />
      <rect x={x+203} y={y+42} width="2" height="6" fill="#8a8079" />
      <text x={x+190} y={y+28} fontFamily="Ubuntu Sans Mono, monospace" fontSize="6" fill="#8a8079" textAnchor="middle">●</text>

      {/* Couch / lounge seating */}
      <g transform={`translate(${x+30},${y+90})`}>
        <rect x="0" y="0" width="120" height="44" fill="#2C001E" />
        <rect x="4" y="6" width="36" height="32" fill="#77216F" />
        <rect x="42" y="6" width="36" height="32" fill="#77216F" />
        <rect x="80" y="6" width="36" height="32" fill="#77216F" />
        <rect x="4" y="6" width="36" height="3" fill="#a14a99" />
        <rect x="42" y="6" width="36" height="3" fill="#a14a99" />
        <rect x="80" y="6" width="36" height="3" fill="#a14a99" />
      </g>

      {/* Coffee table */}
      <rect x={x+60} y={y+148} width="60" height="32" fill="#8B5A3C" />
      <rect x={x+60} y={y+148} width="60" height="2" fill="#A57244" />
      <rect x={x+60} y={y+178} width="60" height="2" fill="#5d3a23" />
      <circle cx={x+75} cy={y+164} r="4" fill="#fff" />
      <circle cx={x+75} cy={y+164} r="2" fill="#3a2510" />
      <rect x={x+90} y={y+158} width="20" height="14" fill="#f4efe8" />
      <rect x={x+92} y={y+161} width="16" height="1" fill="#999" />
      <rect x={x+92} y={y+164} width="14" height="1" fill="#999" />
      <rect x={x+92} y={y+167} width="16" height="1" fill="#999" />

      {/* Bean bag chair */}
      <ellipse cx={x+250} cy={y+150} rx="32" ry="26" fill="#E95420" />
      <ellipse cx={x+250} cy={y+146} rx="28" ry="20" fill="#F5814C" />
      <ellipse cx={x+244} cy={y+140} rx="6" ry="4" fill="#fff" opacity="0.3" />

      {/* Label */}
      <g transform={`translate(${x+w/2-50},${y+h-22})`}>
        <rect x="0" y="0" width="100" height="14" fill="#2C001E" />
        <rect x="0" y="0" width="100" height="2" fill="#4a1f3c" />
        <text x="50" y="10" fontFamily="Ubuntu Sans Mono, monospace" fontSize="9" fill="#F5814C" textAnchor="middle" fontWeight="700" letterSpacing="0.1em">LOUNGE</text>
      </g>
    </svg>
  );
}

function PixChair({ x, y, dir = "N", color = "#5e5651", small = false }) {
  // Top-down chair facing direction (the back is on the side opposite the agent)
  // Render as: backrest + seat + arms
  const sz = small ? 18 : 22;
  const seatColor = color;
  const backColor = "#1E1A18";
  // For simplicity, always render seat as oriented rect and put back-stripe in dir
  let backPos = { x: x - sz/2, y: y - sz/2, w: sz, h: 4 };
  if (dir === "N") backPos = { x: x - sz/2, y: y - sz/2, w: sz, h: 4 };
  if (dir === "S") backPos = { x: x - sz/2, y: y + sz/2 - 4, w: sz, h: 4 };
  if (dir === "W") backPos = { x: x - sz/2, y: y - sz/2, w: 4, h: sz };
  if (dir === "E") backPos = { x: x + sz/2 - 4, y: y - sz/2, w: 4, h: sz };
  return (
    <>
      <rect x={x - sz/2} y={y - sz/2} width={sz} height={sz} fill={seatColor} />
      <rect x={x - sz/2} y={y - sz/2} width={sz} height={1} fill="#fff" opacity="0.2" />
      <rect x={backPos.x} y={backPos.y} width={backPos.w} height={backPos.h} fill={backColor} />
      {/* center wheel base */}
      <circle cx={x} cy={y} r="3" fill="#1E1A18" />
      <circle cx={x} cy={y} r="1.5" fill="#5e5651" />
    </>
  );
}

// ── Plant strips along edges ──
function PlantStrips() {
  // Plants along left/right walls below meeting room
  const plants = [];
  for (let i = 0; i < 6; i++) {
    plants.push({ x: 28, y: 280 + i * 70, kind: i % 2 });
    plants.push({ x: ROOM_W - 56, y: 280 + i * 70, kind: (i+1) % 2 });
  }
  return (
    <svg width={ROOM_W} height={ROOM_H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} shapeRendering="crispEdges">
      {plants.map((p, i) => <PixPlant key={i} x={p.x} y={p.y} kind={p.kind} />)}
    </svg>
  );
}

function PixPlant({ x, y, kind = 0 }) {
  if (kind === 0) {
    // Tall potted plant
    return (
      <g transform={`translate(${x},${y})`}>
        <rect x="6" y="22" width="16" height="14" fill="#8B5A3C" />
        <rect x="6" y="22" width="16" height="2" fill="#A57244" />
        <rect x="6" y="34" width="16" height="2" fill="#5d3a23" />
        {/* leaves */}
        <ellipse cx="14" cy="14" rx="14" ry="14" fill="#2C8B3E" />
        <ellipse cx="9" cy="8" rx="6" ry="9" fill="#3CB04A" transform="rotate(-18 9 8)" />
        <ellipse cx="20" cy="8" rx="5" ry="8" fill="#3CB04A" transform="rotate(18 20 8)" />
        <ellipse cx="14" cy="4" rx="4" ry="7" fill="#5cc966" />
        <rect x="13" y="0" width="1" height="6" fill="#1e5a26" />
      </g>
    );
  }
  // Bushy
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="4" y="24" width="20" height="12" fill="#a14a99" />
      <rect x="4" y="24" width="20" height="2" fill="#c970bd" />
      <rect x="4" y="34" width="20" height="2" fill="#6e2a68" />
      <ellipse cx="14" cy="18" rx="14" ry="10" fill="#2C8B3E" />
      <ellipse cx="6" cy="14" rx="6" ry="6" fill="#3CB04A" />
      <ellipse cx="22" cy="14" rx="6" ry="6" fill="#3CB04A" />
      <ellipse cx="14" cy="10" rx="6" ry="5" fill="#5cc966" />
    </g>
  );
}

// ── Cubicle pod walls ──
function CubiclePod({ cx, cy }) {
  // 4 desks pinwheel around (cx, cy). Cubicle walls between adjacent desks.
  // Outer rough rect of pod
  const r = 90;  // half-extent
  return (
    <svg width={ROOM_W} height={ROOM_H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} shapeRendering="crispEdges">
      {/* Central cross dividers — back-to-back walls between desks */}
      {/* Vertical divider between W-desk and E-desk */}
      <rect x={cx-2} y={cy-50} width="4" height="100" fill="#8a7866" />
      <rect x={cx-2} y={cy-50} width="4" height="2" fill="#b3a288" />
      <rect x={cx-2} y={cy+48} width="4" height="2" fill="#5e4f3f" />
      {/* Horizontal divider between N-desk and S-desk */}
      <rect x={cx-50} y={cy-2} width="100" height="4" fill="#8a7866" />
      <rect x={cx-50} y={cy-2} width="100" height="2" fill="#b3a288" />
      <rect x={cx-50} y={cy} width="100" height="2" fill="#5e4f3f" />

      {/* Soft shadow under the pod */}
      <ellipse cx={cx} cy={cy} rx={r+10} ry={r+4} fill="#000" opacity="0.04" />
    </svg>
  );
}

// ── Workstation (desk + chair + agent), oriented by side ──
// side: 0=N (desk against center, agent sits OUTSIDE pod facing IN)
//       1=E, 2=S, 3=W
function Workstation({ agent, cx, cy, side, selected, onClick }) {
  // For a pinwheel pod, the desk sits against the central divider;
  // the agent's chair sits outside the desk (further from center).
  //
  // Layout, per side, in local coords relative to pod center:
  //   N side: desk at (-46, -48)..(+46, -8), chair at cy-y around -24 above desk?
  // Wait: desk against center wall — for N side desk is at top of pod, agent sits ABOVE desk
  //
  // Let me redo: for "N" desk, the *back* of the desk (where monitor goes) faces the
  // central wall. The desk is in the top half of the pod. Agent sits at the desk
  // facing the central wall, so agent sits BELOW the desk top? No — agent sits at
  // the outer edge looking inward.
  //
  // Actually canonical office: monitor against partition wall, agent's back to corridor.
  // So for N-side desk, the partition is on the SOUTH side of the desk (the inner wall),
  // monitor is on the south edge of the desk (against the wall),
  // agent sits NORTH of the desk (further out) facing south.
  //
  // Hmm flipped. Let me just do: 4 desks each in a quadrant, all with monitors facing
  // the central wall and chairs on the outside.

  // Compute desk + chair rects in absolute coords
  let desk, monitor, keyboard, mouse, chairPos, chairDir, deskRot, agentPos;
  const dw = 92, dh = 40;     // desk: 92 wide, 40 deep (along axis from wall)
  const offWall = 6;          // gap from divider wall to desk back

  if (side === 0) {
    // N quadrant — desk at top of pod, back against the horizontal divider (cy ≈ 0)
    // desk extends from cy-offWall-dh up to cy-offWall
    desk = { x: cx - dw/2, y: cy - offWall - dh, w: dw, h: dh };
    monitor = { x: cx - 16, y: cy - offWall - dh + 2, w: 32, h: 12 };
    keyboard = { x: cx - 14, y: cy - offWall - dh + 18, w: 28, h: 6 };
    mouse   = { x: cx + 16, y: cy - offWall - dh + 20, w: 5, h: 6 };
    chairPos = { x: cx, y: cy - offWall - dh - 16 };
    chairDir = "S"; // chair back faces N (north), seat faces south
    agentPos = { x: cx - 11, y: cy - offWall - dh - 12, dir: "S" };
  } else if (side === 1) {
    // E quadrant
    desk = { x: cx + offWall, y: cy - dw/2, w: dh, h: dw };
    monitor = { x: cx + offWall + 2, y: cy - 16, w: 12, h: 32 };
    keyboard = { x: cx + offWall + 18, y: cy - 14, w: 6, h: 28 };
    mouse   = { x: cx + offWall + 20, y: cy + 16, w: 6, h: 5 };
    chairPos = { x: cx + offWall + dh + 16, y: cy };
    chairDir = "W";
    agentPos = { x: cx + offWall + dh + 12, y: cy - 11, dir: "W" };
  } else if (side === 2) {
    // S quadrant — desk back against cy from below, agent sits south of desk
    desk = { x: cx - dw/2, y: cy + offWall, w: dw, h: dh };
    monitor = { x: cx - 16, y: cy + offWall + dh - 14, w: 32, h: 12 };
    keyboard = { x: cx - 14, y: cy + offWall + dh - 24, w: 28, h: 6 };
    mouse   = { x: cx + 16, y: cy + offWall + dh - 26, w: 5, h: 6 };
    chairPos = { x: cx, y: cy + offWall + dh + 16 };
    chairDir = "N";
    agentPos = { x: cx - 11, y: cy + offWall + dh + 12, dir: "N" };
  } else {
    // W quadrant
    desk = { x: cx - offWall - dh, y: cy - dw/2, w: dh, h: dw };
    monitor = { x: cx - offWall - dh + dh - 14, y: cy - 16, w: 12, h: 32 };
    keyboard = { x: cx - offWall - dh + dh - 24, y: cy - 14, w: 6, h: 28 };
    mouse   = { x: cx - offWall - dh + dh - 26, y: cy + 16, w: 6, h: 5 };
    chairPos = { x: cx - offWall - dh - 16, y: cy };
    chairDir = "E";
    agentPos = { x: cx - offWall - dh - 12 - 22, y: cy - 11, dir: "E" };
  }

  const isWorking = agent.status === "working" || agent.status === "thinking";
  const isDone = agent.status === "done";
  const isError = agent.status === "error";
  const showBubble = (isWorking || isDone || isError) && agent.task;

  // Color picks
  const deskColor = "#8B5A3C";
  const deskTop = "#A57244";
  const deskShade = "#6B4226";
  const screenOn = isError ? "#C7162B" : isWorking ? "#E95420" : isDone ? "#0E8420" : "#2A2522";

  // Bubble position above agent
  let bubbleX, bubbleY, bubbleAnchor = "middle";
  if (side === 0) { bubbleX = cx; bubbleY = chairPos.y - 24; }
  if (side === 2) { bubbleX = cx; bubbleY = chairPos.y + 24; }
  if (side === 1) { bubbleX = chairPos.x + 28; bubbleY = chairPos.y - 4; bubbleAnchor = "start"; }
  if (side === 3) { bubbleX = chairPos.x - 28; bubbleY = chairPos.y - 4; bubbleAnchor = "end"; }

  return (
    <div
      className={"workstation " + (selected ? "selected" : "")}
      onClick={onClick}
      style={{
        position: "absolute", inset: 0, cursor: "pointer",
      }}
    >
      <svg width={ROOM_W} height={ROOM_H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} shapeRendering="crispEdges">
        {/* Desk shadow */}
        <rect x={desk.x + 2} y={desk.y + 2} width={desk.w} height={desk.h} fill="#000" opacity="0.10" />
        {/* Desk top */}
        <rect x={desk.x} y={desk.y} width={desk.w} height={desk.h} fill={deskColor} />
        <rect x={desk.x} y={desk.y} width={desk.w} height="2" fill={deskTop} />
        <rect x={desk.x} y={desk.y + desk.h - 2} width={desk.w} height="2" fill={deskShade} />
        <rect x={desk.x} y={desk.y} width="2" height={desk.h} fill={deskTop} />
        <rect x={desk.x + desk.w - 2} y={desk.y} width="2" height={desk.h} fill={deskShade} />
        {/* Wood grain */}
        <rect x={desk.x + 4} y={desk.y + 8} width={desk.w - 8} height="1" fill={deskShade} opacity="0.4" />
        <rect x={desk.x + 4} y={desk.y + 16} width={desk.w - 8} height="1" fill={deskShade} opacity="0.3" />
        <rect x={desk.x + 4} y={desk.y + 24} width={desk.w - 8} height="1" fill={deskShade} opacity="0.4" />

        {/* Monitor frame + screen */}
        <rect x={monitor.x - 1} y={monitor.y - 1} width={monitor.w + 2} height={monitor.h + 2} fill="#1E1A18" />
        <rect x={monitor.x} y={monitor.y} width={monitor.w} height={monitor.h} fill={screenOn} />
        {/* Screen content lines (when on) */}
        {(isWorking || isDone || isError) && [0, 3, 6, 9].map(off =>
          (side === 0 || side === 2)
            ? <rect key={off} x={monitor.x + 2} y={monitor.y + 2 + off} width={Math.max(4, monitor.w - 4 - (off%3)*4)} height="1" fill={isError ? "#ffb0b8" : isDone ? "#9cdfa4" : "#ffcaa0"} />
            : <rect key={off} x={monitor.x + 2 + off} y={monitor.y + 2} width="1" height={Math.max(4, monitor.h - 4 - (off%3)*4)} fill={isError ? "#ffb0b8" : isDone ? "#9cdfa4" : "#ffcaa0"} />
        )}
        {/* Screen glow */}
        {isWorking && (
          <rect x={monitor.x - 2} y={monitor.y - 2} width={monitor.w + 4} height={monitor.h + 4} fill="#E95420" opacity="0.18">
            <animate attributeName="opacity" values="0.10;0.30;0.10" dur="1.6s" repeatCount="indefinite" />
          </rect>
        )}

        {/* Keyboard */}
        <rect x={keyboard.x} y={keyboard.y} width={keyboard.w} height={keyboard.h} fill="#2a2522" />
        <rect x={keyboard.x} y={keyboard.y} width={keyboard.w} height="1" fill="#5e5651" />
        {/* Keys */}
        {(side === 0 || side === 2) ? (
          [0,1,2,3,4,5,6,7].map(i => <rect key={i} x={keyboard.x + 2 + i*3} y={keyboard.y + 2} width="2" height="2" fill="#8a8079" />)
        ) : (
          [0,1,2,3,4,5,6,7].map(i => <rect key={i} x={keyboard.x + 2} y={keyboard.y + 2 + i*3} width="2" height="2" fill="#8a8079" />)
        )}

        {/* Mouse */}
        <rect x={mouse.x} y={mouse.y} width={mouse.w} height={mouse.h} fill="#2a2522" rx="1" />

        {/* Desk decor: mug or papers depending on plant/monitor flags */}
        {agent.desk.plant && (() => {
          // little plant on desk corner
          let px, py;
          if (side === 0) { px = desk.x + desk.w - 14; py = desk.y + 4; }
          if (side === 2) { px = desk.x + 4; py = desk.y + desk.h - 14; }
          if (side === 1) { px = desk.x + 4; py = desk.y + 4; }
          if (side === 3) { px = desk.x + desk.w - 14; py = desk.y + desk.h - 14; }
          return (
            <g transform={`translate(${px},${py})`}>
              <rect x="2" y="6" width="6" height="4" fill="#8B5A3C" />
              <ellipse cx="5" cy="4" rx="5" ry="4" fill="#2C8B3E" />
              <ellipse cx="3" cy="2" rx="2" ry="3" fill="#3CB04A" />
            </g>
          );
        })()}

        {/* Coffee mug */}
        {!agent.desk.plant && (() => {
          let mx, my;
          if (side === 0) { mx = desk.x + desk.w - 12; my = desk.y + 8; }
          if (side === 2) { mx = desk.x + 6; my = desk.y + desk.h - 12; }
          if (side === 1) { mx = desk.x + 6; my = desk.y + 8; }
          if (side === 3) { mx = desk.x + desk.w - 12; my = desk.y + desk.h - 12; }
          const mugColor = agent.sprite.shirt;
          return (
            <g>
              <circle cx={mx+3} cy={my+3} r="3.5" fill={mugColor} />
              <circle cx={mx+3} cy={my+3} r="2" fill="#3a2510" />
            </g>
          );
        })()}

        {/* Dual monitor */}
        {agent.desk.monitor >= 2 && (() => {
          const mm = { ...monitor };
          if (side === 0 || side === 2) { mm.x = monitor.x + 18; mm.w = 14; }
          else { mm.y = monitor.y + 18; mm.h = 14; }
          return (
            <>
              <rect x={mm.x - 1} y={mm.y - 1} width={mm.w + 2} height={mm.h + 2} fill="#1E1A18" />
              <rect x={mm.x} y={mm.y} width={mm.w} height={mm.h} fill={isWorking ? "#0E8420" : "#2A2522"} />
            </>
          );
        })()}

        {/* Chair */}
        <PixChair x={chairPos.x} y={chairPos.y} dir={chairDir} color={agent.sprite.shirt} />
      </svg>

      {/* Agent sprite (top-down) absolutely positioned */}
      <div style={{
        position: "absolute",
        left: agentPos.x, top: agentPos.y,
        width: 22, height: 22,
        pointerEvents: "none",
      }}>
        <TopDownAgent agent={agent} dir={agentPos.dir} working={isWorking} />
      </div>

      {/* Speech bubble */}
      {showBubble && (
        <div style={{
          position: "absolute",
          left: bubbleX, top: bubbleY,
          transform:
            bubbleAnchor === "middle" ? "translate(-50%, -100%)" :
            bubbleAnchor === "start"  ? "translate(0, -50%)" :
                                        "translate(-100%, -50%)",
          background: "var(--bg-1)",
          border: "1px solid " + (isError ? "var(--error)" : isDone ? "var(--done)" : "rgba(233,84,32,0.5)"),
          padding: "3px 7px",
          borderRadius: 8,
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          whiteSpace: "nowrap",
          color: isError ? "var(--error)" : isDone ? "var(--done)" : "var(--acc)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
          display: "flex", alignItems: "center", gap: 4,
          pointerEvents: "none",
          maxWidth: 180,
          textOverflow: "ellipsis", overflow: "hidden",
          zIndex: 10,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: 50,
            background: isError ? "var(--error)" : isDone ? "var(--done)" : "var(--working)",
            animation: isWorking ? "pulseDot 1.6s infinite" : "none",
          }} />
          {isDone ? "✓ " : ""}{agent.task.length > 22 ? agent.task.slice(0, 22) + "…" : agent.task}
        </div>
      )}

      {/* Name label below chair */}
      <div style={{
        position: "absolute",
        left: chairPos.x, top: chairPos.y + 18,
        transform: "translate(-50%, 0)",
        padding: "1px 6px",
        background: selected ? "var(--acc)" : "var(--bg-1)",
        color: selected ? "white" : "var(--txt-2)",
        border: selected ? "1px solid var(--acc)" : "1px solid var(--line)",
        borderRadius: 999,
        fontSize: 9.5,
        fontWeight: 600,
        fontFamily: "var(--font-sans)",
        whiteSpace: "nowrap",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        pointerEvents: "none",
        zIndex: 5,
      }}>
        {agent.short}
      </div>

      {/* Selection ring */}
      {selected && (
        <svg width={ROOM_W} height={ROOM_H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <rect
            x={Math.min(desk.x, chairPos.x - 14) - 4}
            y={Math.min(desk.y, chairPos.y - 14) - 4}
            width={Math.max(desk.w, 28) + Math.abs(chairPos.x - desk.x) + 8}
            height={Math.max(desk.h, 28) + Math.abs(chairPos.y - desk.y) + 8}
            fill="none" stroke="var(--acc)" strokeWidth="2" strokeDasharray="3 2" rx="3"
          />
        </svg>
      )}
    </div>
  );
}

// ── Top-down agent (head + shoulders, ~22x22) ──
function TopDownAgent({ agent, dir = "S", working = false }) {
  const skin = agent.sprite.skin;
  const hair = agent.sprite.hair;
  const shirt = agent.sprite.shirt;

  // Direction affects hair coverage and where face is
  // dir is the direction the agent FACES (the way the screen is)
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" shapeRendering="crispEdges"
      style={{ animation: working ? "typeShake 0.25s infinite linear" : "none" }}>
      {/* Shoulders (shirt) — visible behind head */}
      <rect x="2" y="11" width="18" height="9" fill={shirt} />
      <rect x="2" y="11" width="18" height="1" fill={shadeColor2(shirt, 20)} />
      <rect x="2" y="19" width="18" height="1" fill={shadeColor2(shirt, -20)} />
      {/* Collar */}
      <rect x="9" y="11" width="4" height="2" fill={shadeColor2(shirt, -20)} />

      {/* Head (skin) */}
      <rect x="5" y="2" width="12" height="11" fill={skin} />
      <rect x="5" y="2" width="12" height="1" fill={shadeColor2(skin, 15)} />
      <rect x="5" y="12" width="12" height="1" fill={shadeColor2(skin, -20)} />

      {/* Hair (covers top + sides + back depending on dir) */}
      {/* always top */}
      <rect x="5" y="2" width="12" height="3" fill={hair} />
      <rect x="4" y="3" width="14" height="2" fill={hair} />
      {/* sides */}
      {dir !== "S" && <rect x="4" y="5" width="2" height="6" fill={hair} />}
      {dir !== "S" && <rect x="16" y="5" width="2" height="6" fill={hair} />}
      {/* if facing away (N, E from viewer's standpoint — i.e. agent's back to us), hair covers more */}
      {(dir === "N" || dir === "S") && dir === "N" && (
        <rect x="5" y="5" width="12" height="6" fill={hair} />
      )}

      {/* Face details when facing south (toward viewer) */}
      {dir === "S" && (
        <>
          <rect x="8" y="7" width="1" height="1" fill="#1E1A18" />
          <rect x="13" y="7" width="1" height="1" fill="#1E1A18" />
          <rect x="10" y="10" width="2" height="1" fill={shadeColor2(skin, -30)} />
        </>
      )}
      {/* Face details when facing east */}
      {dir === "E" && (
        <>
          <rect x="14" y="7" width="1" height="1" fill="#1E1A18" />
          <rect x="14" y="10" width="2" height="1" fill={shadeColor2(skin, -30)} />
        </>
      )}
      {/* Face details when facing west */}
      {dir === "W" && (
        <>
          <rect x="7" y="7" width="1" height="1" fill="#1E1A18" />
          <rect x="6" y="10" width="2" height="1" fill={shadeColor2(skin, -30)} />
        </>
      )}
    </svg>
  );
}

function shadeColor2(hex, percent) {
  const f = parseInt(hex.slice(1), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const R = f >> 16, G = (f >> 8) & 0x00FF, B = f & 0x0000FF;
  const r = Math.round((t - R) * p) + R;
  const g = Math.round((t - G) * p) + G;
  const b = Math.round((t - B) * p) + B;
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ── Scattered details: rugs, trash cans, printer, water cooler ──
function Details() {
  return (
    <svg width={ROOM_W} height={ROOM_H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} shapeRendering="crispEdges">
      {/* Hallway rug between pods (horizontal) */}
      <rect x="180" y="475" width="680" height="20" fill="#77216F" opacity="0.35" />
      <rect x="180" y="475" width="680" height="2" fill="#a14a99" opacity="0.5" />
      <rect x="180" y="493" width="680" height="2" fill="#4a0f44" opacity="0.5" />

      {/* Vertical rug */}
      <rect x="475" y="280" width="20" height="400" fill="#77216F" opacity="0.35" />

      {/* Water cooler bottom-center */}
      <g transform="translate(490, 270)">
        <rect x="0" y="14" width="20" height="20" fill="#A0C4D8" />
        <rect x="0" y="14" width="20" height="2" fill="#7BA0B8" />
        <rect x="0" y="32" width="20" height="2" fill="#5e7a8a" />
        <rect x="4" y="0" width="12" height="16" fill="#5e8aa0" />
        <ellipse cx="10" cy="2" rx="6" ry="2" fill="#7BA0B8" />
        <rect x="8" y="24" width="4" height="3" fill="#2C001E" />
      </g>

      {/* Printer (top of left pod) */}
      <g transform="translate(120, 270)">
        <rect x="0" y="0" width="34" height="22" fill="#c7bfb7" />
        <rect x="0" y="0" width="34" height="2" fill="#e8e2dc" />
        <rect x="0" y="20" width="34" height="2" fill="#8a8079" />
        <rect x="3" y="6" width="28" height="3" fill="#2a2522" />
        <rect x="4" y="12" width="26" height="6" fill="#f4efe8" />
        <rect x="4" y="12" width="26" height="1" fill="#c7bfb7" />
      </g>

      {/* Trash can */}
      <g transform="translate(140, 670)">
        <rect x="2" y="2" width="14" height="18" fill="#5e5651" />
        <rect x="2" y="2" width="14" height="2" fill="#8a8079" />
        <rect x="0" y="0" width="18" height="3" fill="#1E1A18" />
        <rect x="6" y="5" width="6" height="4" fill="#3a3530" />
      </g>

      {/* Filing cabinet */}
      <g transform="translate(875, 680)">
        <rect x="0" y="0" width="40" height="28" fill="#8a8079" />
        <rect x="0" y="0" width="40" height="2" fill="#b3a99f" />
        <rect x="0" y="13" width="40" height="2" fill="#5e5651" />
        <rect x="0" y="26" width="40" height="2" fill="#5e5651" />
        <rect x="17" y="6" width="6" height="2" fill="#2a2522" />
        <rect x="17" y="19" width="6" height="2" fill="#2a2522" />
      </g>

      {/* Whiteboard mounted on wall */}
      <g transform="translate(560, 16)">
        <rect x="0" y="0" width="80" height="30" fill="#f4efe8" />
        <rect x="0" y="0" width="80" height="2" fill="#8a8079" />
        <rect x="0" y="28" width="80" height="2" fill="#5e5651" />
        <text x="6" y="10" fontFamily="Ubuntu Sans Mono, monospace" fontSize="6" fill="#E95420" fontWeight="700">SPRINT 24</text>
        <text x="6" y="18" fontFamily="Ubuntu Sans Mono, monospace" fontSize="5" fill="#2C001E">· ship checkout</text>
        <text x="6" y="24" fontFamily="Ubuntu Sans Mono, monospace" fontSize="5" fill="#2C001E">· a11y pass</text>
      </g>

      {/* Standing plants */}
      <g transform="translate(905, 260)"><use href="#tallPlant" /></g>

      <defs>
        <g id="tallPlant">
          <rect x="4" y="32" width="28" height="22" fill="#8B5A3C" />
          <rect x="4" y="32" width="28" height="2" fill="#A57244" />
          <ellipse cx="18" cy="20" rx="20" ry="20" fill="#2C8B3E" />
          <ellipse cx="10" cy="10" rx="8" ry="12" fill="#3CB04A" />
          <ellipse cx="26" cy="10" rx="7" ry="11" fill="#3CB04A" />
          <ellipse cx="18" cy="6" rx="6" ry="9" fill="#5cc966" />
        </g>
      </defs>
    </svg>
  );
}

Object.assign(window, { IsoOffice, CardsOffice, StatusDot, TopDownOffice });
