import { shadeColor } from "@/components/ui/pixel-sprite.utils";
import type { OfficeAgent } from "../../hooks/use-office-agents";
import type { Dir } from "./constants";

export function PixChair({
  x,
  y,
  dir = "N",
  color = "#5e5651",
  small = false,
}: {
  x: number;
  y: number;
  dir?: Dir;
  color?: string;
  small?: boolean;
}) {
  const sz = small ? 18 : 22;
  const backColor = "#1E1A18";
  let backPos = { x: x - sz / 2, y: y - sz / 2, w: sz, h: 4 };
  if (dir === "N") backPos = { x: x - sz / 2, y: y - sz / 2, w: sz, h: 4 };
  if (dir === "S") backPos = { x: x - sz / 2, y: y + sz / 2 - 4, w: sz, h: 4 };
  if (dir === "W") backPos = { x: x - sz / 2, y: y - sz / 2, w: 4, h: sz };
  if (dir === "E") backPos = { x: x + sz / 2 - 4, y: y - sz / 2, w: 4, h: sz };
  return (
    <>
      <rect x={x - sz / 2} y={y - sz / 2} width={sz} height={sz} fill={color} />
      <rect x={x - sz / 2} y={y - sz / 2} width={sz} height={1} fill="#fff" opacity="0.2" />
      <rect x={backPos.x} y={backPos.y} width={backPos.w} height={backPos.h} fill={backColor} />
      <circle cx={x} cy={y} r="3" fill="#1E1A18" />
      <circle cx={x} cy={y} r="1.5" fill="#5e5651" />
    </>
  );
}

export function PixPlant({ x, y, kind = 0 }: { x: number; y: number; kind?: number }) {
  if (kind === 0) {
    return (
      <g transform={`translate(${x},${y})`}>
        <rect x="6" y="22" width="16" height="14" fill="#8B5A3C" />
        <rect x="6" y="22" width="16" height="2" fill="#A57244" />
        <rect x="6" y="34" width="16" height="2" fill="#5d3a23" />
        <ellipse cx="14" cy="14" rx="14" ry="14" fill="#2C8B3E" />
        <ellipse cx="9" cy="8" rx="6" ry="9" fill="#3CB04A" transform="rotate(-18 9 8)" />
        <ellipse cx="20" cy="8" rx="5" ry="8" fill="#3CB04A" transform="rotate(18 20 8)" />
        <ellipse cx="14" cy="4" rx="4" ry="7" fill="#5cc966" />
        <rect x="13" y="0" width="1" height="6" fill="#1e5a26" />
      </g>
    );
  }
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

export function TopDownAgent({
  agent,
  dir = "S",
  working = false,
}: {
  agent: OfficeAgent;
  dir?: Dir;
  working?: boolean;
}) {
  const skin = agent.sprite?.skin ?? "#F1C8A0";
  const hair = agent.sprite?.hair ?? "#3a2510";
  const shirt = agent.sprite?.shirt ?? "#5e5651";
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      shapeRendering="crispEdges"
      style={{ animation: working ? "typeShake 0.25s infinite linear" : "none" }}
    >
      <rect x="2" y="11" width="18" height="9" fill={shirt} />
      <rect x="2" y="11" width="18" height="1" fill={shadeColor(shirt, 20)} />
      <rect x="2" y="19" width="18" height="1" fill={shadeColor(shirt, -20)} />
      <rect x="9" y="11" width="4" height="2" fill={shadeColor(shirt, -20)} />

      <rect x="5" y="2" width="12" height="11" fill={skin} />
      <rect x="5" y="2" width="12" height="1" fill={shadeColor(skin, 15)} />
      <rect x="5" y="12" width="12" height="1" fill={shadeColor(skin, -20)} />

      <rect x="5" y="2" width="12" height="3" fill={hair} />
      <rect x="4" y="3" width="14" height="2" fill={hair} />
      {dir !== "S" ? <rect x="4" y="5" width="2" height="6" fill={hair} /> : null}
      {dir !== "S" ? <rect x="16" y="5" width="2" height="6" fill={hair} /> : null}
      {dir === "N" ? <rect x="5" y="5" width="12" height="6" fill={hair} /> : null}

      {dir === "S" ? (
        <>
          <rect x="8" y="7" width="1" height="1" fill="#1E1A18" />
          <rect x="13" y="7" width="1" height="1" fill="#1E1A18" />
          <rect x="10" y="10" width="2" height="1" fill={shadeColor(skin, -30)} />
        </>
      ) : null}
      {dir === "E" ? (
        <>
          <rect x="14" y="7" width="1" height="1" fill="#1E1A18" />
          <rect x="14" y="10" width="2" height="1" fill={shadeColor(skin, -30)} />
        </>
      ) : null}
      {dir === "W" ? (
        <>
          <rect x="7" y="7" width="1" height="1" fill="#1E1A18" />
          <rect x="6" y="10" width="2" height="1" fill={shadeColor(skin, -30)} />
        </>
      ) : null}
    </svg>
  );
}
