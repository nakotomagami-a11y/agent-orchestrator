import { ROOM_W, ROOM_H, SVG_BASE_STYLE, SVG_OVERLAY_STYLE } from "./constants";
import { PixChair, PixPlant } from "./sprites";

export function FloorPlan() {
  return (
    <svg
      width={ROOM_W}
      height={ROOM_H}
      style={SVG_BASE_STYLE}
      shapeRendering="crispEdges"
    >
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
      <rect x="0" y="0" width={ROOM_W} height="14" fill="url(#wallTex)" />
      <rect x="0" y={ROOM_H - 14} width={ROOM_W} height="14" fill="url(#wallTex)" />
      <rect x="0" y="0" width="14" height={ROOM_H} fill="url(#wallTex)" />
      <rect x={ROOM_W - 14} y="0" width="14" height={ROOM_H} fill="url(#wallTex)" />
      <rect x="0" y="14" width={ROOM_W} height="2" fill="#2a2018" />
      <rect x="0" y={ROOM_H - 16} width={ROOM_W} height="2" fill="#2a2018" />
      <rect x="14" y="0" width="2" height={ROOM_H} fill="#2a2018" />
      <rect x={ROOM_W - 16} y="0" width="2" height={ROOM_H} fill="#2a2018" />
    </svg>
  );
}

export function MeetingRoom() {
  const x = 60;
  const y = 40;
  const w = 540;
  const h = 200;
  const topChairs: number[] = [80, 160, 240, 320, 400];
  const bottomChairs: number[] = [80, 160, 240, 320, 400];
  return (
    <svg
      width={ROOM_W}
      height={ROOM_H}
      style={SVG_OVERLAY_STYLE}
      shapeRendering="crispEdges"
    >
      <rect x={x} y={y} width={w} height="6" fill="#5e5145" />
      <rect x={x} y={y} width="6" height={h} fill="#5e5145" />
      <rect x={x + w - 6} y={y} width="6" height={h} fill="#5e5145" />
      <rect x={x} y={y + 6} width={w} height="2" fill="#3a3128" />
      <rect x={x + 6} y={y} width="2" height={h} fill="#3a3128" />
      <rect x={x + w - 8} y={y} width="2" height={h} fill="#3a3128" />

      <rect x={x + 8} y={y + 8} width={w - 16} height={h - 16} fill="#e2d3bd" opacity="0.4" />

      {[140, 260, 380, 500].map((wx) => (
        <g key={wx}>
          <rect x={wx} y={y - 1} width="60" height="8" fill="#A0C4D8" />
          <rect x={wx} y={y - 1} width="60" height="2" fill="#7BA0B8" />
          <rect x={wx + 29} y={y - 1} width="2" height="8" fill="#7BA0B8" />
        </g>
      ))}

      <g transform={`translate(${x + w / 2 - 100},${y + 58})`}>
        <rect x="0" y="0" width="200" height="80" fill="#8B5A3C" />
        <rect x="0" y="0" width="200" height="3" fill="#A57244" />
        <rect x="0" y="77" width="200" height="3" fill="#5d3a23" />
        <rect x="0" y="0" width="3" height="80" fill="#A57244" />
        <rect x="197" y="0" width="3" height="80" fill="#5d3a23" />
        <rect x="98" y="0" width="2" height="80" fill="#5d3a23" opacity="0.5" />
        <rect x="85" y="32" width="30" height="18" fill="#1E1A18" />
        <rect x="87" y="34" width="26" height="14" fill="#E95420" opacity="0.7" />
        <rect x="87" y="34" width="26" height="2" fill="#F5814C" />
        <circle cx="40" cy="20" r="5" fill="#fff" />
        <circle cx="40" cy="20" r="3" fill="#3a2510" />
        <circle cx="160" cy="60" r="5" fill="#fff" />
        <circle cx="160" cy="60" r="3" fill="#3a2510" />
        <rect x="135" y="14" width="14" height="18" fill="#f4efe8" />
        <rect x="137" y="17" width="10" height="1" fill="#999" />
        <rect x="137" y="20" width="10" height="1" fill="#999" />
        <rect x="137" y="23" width="6" height="1" fill="#999" />
      </g>

      {topChairs.map((cx) => (
        <PixChair key={`t${cx}`} x={x + cx} y={y + 30} dir="N" color="#C7162B" />
      ))}
      {bottomChairs.map((cx) => (
        <PixChair key={`b${cx}`} x={x + cx} y={y + 150} dir="S" color="#C7162B" />
      ))}
      <PixChair x={x + 30} y={y + 90} dir="W" color="#C7162B" />
      <PixChair x={x + w - 50} y={y + 90} dir="E" color="#C7162B" />

      <g transform={`translate(${x + w / 2 - 50},${y + h - 22})`}>
        <rect x="0" y="0" width="100" height="14" fill="#2C001E" />
        <rect x="0" y="0" width="100" height="2" fill="#4a1f3c" />
        <text
          x="50"
          y="10"
          fontFamily="var(--font-mono)"
          fontSize="9"
          fill="#F5814C"
          textAnchor="middle"
          fontWeight="700"
          letterSpacing="0.1em"
        >
          MEETING
        </text>
      </g>
    </svg>
  );
}

export function CoffeeCorner() {
  const x = 640;
  const y = 40;
  const w = 360;
  const h = 200;
  return (
    <svg
      width={ROOM_W}
      height={ROOM_H}
      style={SVG_OVERLAY_STYLE}
      shapeRendering="crispEdges"
    >
      <rect x={x} y={y} width={w} height="6" fill="#5e5145" />
      <rect x={x} y={y} width="6" height={h} fill="#5e5145" />
      <rect x={x + w - 6} y={y} width="6" height={h} fill="#5e5145" />
      <rect x={x} y={y + 6} width={w} height="2" fill="#3a3128" />
      <rect x={x + 6} y={y} width="2" height={h} fill="#3a3128" />
      <rect x={x + w - 8} y={y} width="2" height={h} fill="#3a3128" />

      <rect x={x + 8} y={y + 8} width={w - 16} height={h - 16} fill="#a07a5a" opacity="0.18" />

      <rect x={x + w - 1} y={y + 30} width="8" height="80" fill="#A0C4D8" />
      <rect x={x + w - 1} y={y + 30} width="2" height="80" fill="#7BA0B8" />
      <rect x={x + w - 1} y={y + 68} width="8" height="2" fill="#7BA0B8" />

      <rect x={x + 20} y={y + 20} width="200" height="34" fill="#8a8079" />
      <rect x={x + 20} y={y + 20} width="200" height="3" fill="#b3a99f" />
      <rect x={x + 20} y={y + 51} width="200" height="3" fill="#5e5651" />
      <rect x={x + 40} y={y + 10} width="22" height="22" fill="#2C001E" />
      <rect x={x + 42} y={y + 12} width="18" height="6" fill="#E95420" />
      <rect x={x + 48} y={y + 22} width="6" height="4" fill="#1E1A18" />
      <rect x={x + 80} y={y + 24} width="34" height="22" fill="#2a2522" />
      <rect x={x + 82} y={y + 26} width="30" height="18" fill="#5e5651" />
      <rect x={x + 95} y={y + 18} width="3" height="8" fill="#b3a99f" />
      <rect x={x + 170} y={y + 10} width="40" height="46" fill="#f4efe8" />
      <rect x={x + 170} y={y + 10} width="40" height="2" fill="#c7bfb7" />
      <rect x={x + 170} y={y + 34} width="40" height="2" fill="#c7bfb7" />
      <rect x={x + 203} y={y + 18} width="2" height="6" fill="#8a8079" />
      <rect x={x + 203} y={y + 42} width="2" height="6" fill="#8a8079" />

      <g transform={`translate(${x + 30},${y + 90})`}>
        <rect x="0" y="0" width="120" height="44" fill="#2C001E" />
        <rect x="4" y="6" width="36" height="32" fill="#77216F" />
        <rect x="42" y="6" width="36" height="32" fill="#77216F" />
        <rect x="80" y="6" width="36" height="32" fill="#77216F" />
        <rect x="4" y="6" width="36" height="3" fill="#a14a99" />
        <rect x="42" y="6" width="36" height="3" fill="#a14a99" />
        <rect x="80" y="6" width="36" height="3" fill="#a14a99" />
      </g>

      <rect x={x + 60} y={y + 148} width="60" height="32" fill="#8B5A3C" />
      <rect x={x + 60} y={y + 148} width="60" height="2" fill="#A57244" />
      <rect x={x + 60} y={y + 178} width="60" height="2" fill="#5d3a23" />
      <circle cx={x + 75} cy={y + 164} r="4" fill="#fff" />
      <circle cx={x + 75} cy={y + 164} r="2" fill="#3a2510" />
      <rect x={x + 90} y={y + 158} width="20" height="14" fill="#f4efe8" />
      <rect x={x + 92} y={y + 161} width="16" height="1" fill="#999" />
      <rect x={x + 92} y={y + 164} width="14" height="1" fill="#999" />
      <rect x={x + 92} y={y + 167} width="16" height="1" fill="#999" />

      <ellipse cx={x + 250} cy={y + 150} rx="32" ry="26" fill="#E95420" />
      <ellipse cx={x + 250} cy={y + 146} rx="28" ry="20" fill="#F5814C" />
      <ellipse cx={x + 244} cy={y + 140} rx="6" ry="4" fill="#fff" opacity="0.3" />

      <g transform={`translate(${x + w / 2 - 50},${y + h - 22})`}>
        <rect x="0" y="0" width="100" height="14" fill="#2C001E" />
        <rect x="0" y="0" width="100" height="2" fill="#4a1f3c" />
        <text
          x="50"
          y="10"
          fontFamily="var(--font-mono)"
          fontSize="9"
          fill="#F5814C"
          textAnchor="middle"
          fontWeight="700"
          letterSpacing="0.1em"
        >
          LOUNGE
        </text>
      </g>
    </svg>
  );
}

export function PlantStrips() {
  const plants: Array<{ x: number; y: number; kind: number }> = [];
  for (let i = 0; i < 6; i++) {
    plants.push({ x: 28, y: 280 + i * 70, kind: i % 2 });
    plants.push({ x: ROOM_W - 56, y: 280 + i * 70, kind: (i + 1) % 2 });
  }
  return (
    <svg
      width={ROOM_W}
      height={ROOM_H}
      style={SVG_OVERLAY_STYLE}
      shapeRendering="crispEdges"
    >
      {plants.map((p, i) => (
        <PixPlant key={i} x={p.x} y={p.y} kind={p.kind} />
      ))}
    </svg>
  );
}

export function CubiclePod({ cx, cy }: { cx: number; cy: number }) {
  const r = 90;
  return (
    <svg
      width={ROOM_W}
      height={ROOM_H}
      style={SVG_OVERLAY_STYLE}
      shapeRendering="crispEdges"
    >
      <rect x={cx - 2} y={cy - 50} width="4" height="100" fill="#8a7866" />
      <rect x={cx - 2} y={cy - 50} width="4" height="2" fill="#b3a288" />
      <rect x={cx - 2} y={cy + 48} width="4" height="2" fill="#5e4f3f" />
      <rect x={cx - 50} y={cy - 2} width="100" height="4" fill="#8a7866" />
      <rect x={cx - 50} y={cy - 2} width="100" height="2" fill="#b3a288" />
      <rect x={cx - 50} y={cy} width="100" height="2" fill="#5e4f3f" />
      <ellipse cx={cx} cy={cy} rx={r + 10} ry={r + 4} fill="#000" opacity="0.04" />
    </svg>
  );
}
