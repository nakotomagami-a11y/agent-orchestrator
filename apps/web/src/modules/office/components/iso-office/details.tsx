import { ROOM_W, ROOM_H, SVG_OVERLAY_STYLE } from "./constants";

export function Details() {
  return (
    <svg
      width={ROOM_W}
      height={ROOM_H}
      style={SVG_OVERLAY_STYLE}
      shapeRendering="crispEdges"
    >
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

      <rect x="180" y="475" width="680" height="20" fill="#77216F" opacity="0.35" />
      <rect x="180" y="475" width="680" height="2" fill="#a14a99" opacity="0.5" />
      <rect x="180" y="493" width="680" height="2" fill="#4a0f44" opacity="0.5" />

      <rect x="475" y="280" width="20" height="400" fill="#77216F" opacity="0.35" />

      <g transform="translate(490, 270)">
        <rect x="0" y="14" width="20" height="20" fill="#A0C4D8" />
        <rect x="0" y="14" width="20" height="2" fill="#7BA0B8" />
        <rect x="0" y="32" width="20" height="2" fill="#5e7a8a" />
        <rect x="4" y="0" width="12" height="16" fill="#5e8aa0" />
        <ellipse cx="10" cy="2" rx="6" ry="2" fill="#7BA0B8" />
        <rect x="8" y="24" width="4" height="3" fill="#2C001E" />
      </g>

      <g transform="translate(120, 270)">
        <rect x="0" y="0" width="34" height="22" fill="#c7bfb7" />
        <rect x="0" y="0" width="34" height="2" fill="#e8e2dc" />
        <rect x="0" y="20" width="34" height="2" fill="#8a8079" />
        <rect x="3" y="6" width="28" height="3" fill="#2a2522" />
        <rect x="4" y="12" width="26" height="6" fill="#f4efe8" />
        <rect x="4" y="12" width="26" height="1" fill="#c7bfb7" />
      </g>

      <g transform="translate(140, 670)">
        <rect x="2" y="2" width="14" height="18" fill="#5e5651" />
        <rect x="2" y="2" width="14" height="2" fill="#8a8079" />
        <rect x="0" y="0" width="18" height="3" fill="#1E1A18" />
        <rect x="6" y="5" width="6" height="4" fill="#3a3530" />
      </g>

      <g transform="translate(875, 680)">
        <rect x="0" y="0" width="40" height="28" fill="#8a8079" />
        <rect x="0" y="0" width="40" height="2" fill="#b3a99f" />
        <rect x="0" y="13" width="40" height="2" fill="#5e5651" />
        <rect x="0" y="26" width="40" height="2" fill="#5e5651" />
        <rect x="17" y="6" width="6" height="2" fill="#2a2522" />
        <rect x="17" y="19" width="6" height="2" fill="#2a2522" />
      </g>

      <g transform="translate(560, 16)">
        <rect x="0" y="0" width="80" height="30" fill="#f4efe8" />
        <rect x="0" y="0" width="80" height="2" fill="#8a8079" />
        <rect x="0" y="28" width="80" height="2" fill="#5e5651" />
        <text
          x="6"
          y="10"
          fontFamily="var(--font-mono)"
          fontSize="6"
          fill="#E95420"
          fontWeight="700"
        >
          SPRINT 24
        </text>
        <text x="6" y="18" fontFamily="var(--font-mono)" fontSize="5" fill="#2C001E">
          · ship checkout
        </text>
        <text x="6" y="24" fontFamily="var(--font-mono)" fontSize="5" fill="#2C001E">
          · a11y pass
        </text>
      </g>

      <g transform="translate(905, 260)">
        <use href="#tallPlant" />
      </g>
    </svg>
  );
}
