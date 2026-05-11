import { memo } from "react";
import type { OfficeAgent } from "../../hooks/use-office-agents";
import {
  ROOM_W,
  ROOM_H,
  SVG_OVERLAY_STYLE,
  WORKSTATION_LAYER_STYLE,
  type Dir,
  type Rect,
  type Side,
} from "./constants";
import { PixChair, TopDownAgent } from "./sprites";

const TOPDOWN_AGENT_WRAP_BASE = {
  position: "absolute" as const,
  width: 22,
  height: 22,
  pointerEvents: "none" as const,
};

const BUBBLE_BASE: React.CSSProperties = {
  position: "absolute",
  background: "var(--bg-1)",
  padding: "3px 7px",
  borderRadius: 8,
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  whiteSpace: "nowrap",
  boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
  display: "flex",
  alignItems: "center",
  gap: 4,
  pointerEvents: "none",
  maxWidth: 180,
  textOverflow: "ellipsis",
  overflow: "hidden",
  zIndex: 10,
};

const BUBBLE_DOT_BASE: React.CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: 50,
};

const NAME_PILL_BASE: React.CSSProperties = {
  position: "absolute",
  transform: "translate(-50%, 0)",
  padding: "1px 6px",
  borderRadius: 999,
  fontSize: 9.5,
  fontWeight: 600,
  fontFamily: "var(--font-sans)",
  whiteSpace: "nowrap",
  boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
  pointerEvents: "none",
  zIndex: 5,
};

const HIT_BUTTON_BASE: React.CSSProperties = {
  position: "absolute",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  pointerEvents: "auto",
  borderRadius: 4,
};

function WorkstationImpl({
  agent,
  cx,
  cy,
  side,
  selected,
  onClick,
}: {
  agent: OfficeAgent;
  cx: number;
  cy: number;
  side: Side;
  selected: boolean;
  onClick: () => void;
}) {
  const dw = 92;
  const dh = 40;
  const offWall = 6;

  let desk: Rect;
  let monitor: Rect;
  let keyboard: Rect;
  let mouse: Rect;
  let chairPos: { x: number; y: number };
  let chairDir: Dir;
  let agentPos: { x: number; y: number; dir: Dir };

  if (side === 0) {
    desk = { x: cx - dw / 2, y: cy - offWall - dh, w: dw, h: dh };
    monitor = { x: cx - 16, y: cy - offWall - dh + 2, w: 32, h: 12 };
    keyboard = { x: cx - 14, y: cy - offWall - dh + 18, w: 28, h: 6 };
    mouse = { x: cx + 16, y: cy - offWall - dh + 20, w: 5, h: 6 };
    chairPos = { x: cx, y: cy - offWall - dh - 16 };
    chairDir = "S";
    agentPos = { x: cx - 11, y: cy - offWall - dh - 12, dir: "S" };
  } else if (side === 1) {
    desk = { x: cx + offWall, y: cy - dw / 2, w: dh, h: dw };
    monitor = { x: cx + offWall + 2, y: cy - 16, w: 12, h: 32 };
    keyboard = { x: cx + offWall + 18, y: cy - 14, w: 6, h: 28 };
    mouse = { x: cx + offWall + 20, y: cy + 16, w: 6, h: 5 };
    chairPos = { x: cx + offWall + dh + 16, y: cy };
    chairDir = "W";
    agentPos = { x: cx + offWall + dh + 12, y: cy - 11, dir: "W" };
  } else if (side === 2) {
    desk = { x: cx - dw / 2, y: cy + offWall, w: dw, h: dh };
    monitor = { x: cx - 16, y: cy + offWall + dh - 14, w: 32, h: 12 };
    keyboard = { x: cx - 14, y: cy + offWall + dh - 24, w: 28, h: 6 };
    mouse = { x: cx + 16, y: cy + offWall + dh - 26, w: 5, h: 6 };
    chairPos = { x: cx, y: cy + offWall + dh + 16 };
    chairDir = "N";
    agentPos = { x: cx - 11, y: cy + offWall + dh + 12, dir: "N" };
  } else {
    desk = { x: cx - offWall - dh, y: cy - dw / 2, w: dh, h: dw };
    monitor = { x: cx - offWall - 14, y: cy - 16, w: 12, h: 32 };
    keyboard = { x: cx - offWall - 24, y: cy - 14, w: 6, h: 28 };
    mouse = { x: cx - offWall - 26, y: cy + 16, w: 6, h: 5 };
    chairPos = { x: cx - offWall - dh - 16, y: cy };
    chairDir = "E";
    agentPos = { x: cx - offWall - dh - 34, y: cy - 11, dir: "E" };
  }

  const isWorking = agent.status === "working" || agent.status === "thinking";
  const isDone = agent.status === "done";
  const isError = agent.status === "error";
  const showBubble = (isWorking || isDone || isError) && !!agent.task;
  const shirtColor = agent.sprite?.shirt ?? "#5e5651";

  const deskColor = "#8B5A3C";
  const deskTop = "#A57244";
  const deskShade = "#6B4226";
  const screenOn = isError
    ? "#C7162B"
    : isWorking
      ? "#E95420"
      : isDone
        ? "#0E8420"
        : "#2A2522";

  let bubbleX = chairPos.x;
  let bubbleY = chairPos.y - 24;
  let bubbleAnchor: "start" | "middle" | "end" = "middle";
  if (side === 0) {
    bubbleX = cx;
    bubbleY = chairPos.y - 24;
  } else if (side === 2) {
    bubbleX = cx;
    bubbleY = chairPos.y + 24;
  } else if (side === 1) {
    bubbleX = chairPos.x + 28;
    bubbleY = chairPos.y - 4;
    bubbleAnchor = "start";
  } else {
    bubbleX = chairPos.x - 28;
    bubbleY = chairPos.y - 4;
    bubbleAnchor = "end";
  }

  const horizontalSide = side === 0 || side === 2;
  const fillLine = isError ? "#ffb0b8" : isDone ? "#9cdfa4" : "#ffcaa0";

  const ariaLabel = `${agent.name} (${agent.status})`;

  // Bounding box that covers desk + chair + name label, used as the
  // click/focus target. Without this each workstation div would span the
  // entire 1040×720 stage and only the top-most would receive clicks.
  const hitX = Math.min(desk.x, chairPos.x - 14) - 4;
  const hitY = Math.min(desk.y, chairPos.y - 14) - 4;
  const hitW = Math.max(desk.w, 28) + Math.abs(chairPos.x - desk.x) + 8;
  const hitH = Math.max(desk.h, 28) + Math.abs(chairPos.y - desk.y) + 8 + 20;

  return (
    <div
      className={"workstation" + (selected ? " selected" : "")}
      style={WORKSTATION_LAYER_STYLE}
    >
      <svg
        width={ROOM_W}
        height={ROOM_H}
        style={SVG_OVERLAY_STYLE}
        shapeRendering="crispEdges"
      >
        <rect x={desk.x + 2} y={desk.y + 2} width={desk.w} height={desk.h} fill="#000" opacity="0.10" />
        <rect x={desk.x} y={desk.y} width={desk.w} height={desk.h} fill={deskColor} />
        <rect x={desk.x} y={desk.y} width={desk.w} height="2" fill={deskTop} />
        <rect x={desk.x} y={desk.y + desk.h - 2} width={desk.w} height="2" fill={deskShade} />
        <rect x={desk.x} y={desk.y} width="2" height={desk.h} fill={deskTop} />
        <rect x={desk.x + desk.w - 2} y={desk.y} width="2" height={desk.h} fill={deskShade} />
        <rect x={desk.x + 4} y={desk.y + 8} width={desk.w - 8} height="1" fill={deskShade} opacity="0.4" />
        <rect x={desk.x + 4} y={desk.y + 16} width={desk.w - 8} height="1" fill={deskShade} opacity="0.3" />
        <rect x={desk.x + 4} y={desk.y + 24} width={desk.w - 8} height="1" fill={deskShade} opacity="0.4" />

        <rect
          x={monitor.x - 1}
          y={monitor.y - 1}
          width={monitor.w + 2}
          height={monitor.h + 2}
          fill="#1E1A18"
        />
        <rect x={monitor.x} y={monitor.y} width={monitor.w} height={monitor.h} fill={screenOn} />
        {(isWorking || isDone || isError) &&
          [0, 3, 6, 9].map((off) =>
            horizontalSide ? (
              <rect
                key={off}
                x={monitor.x + 2}
                y={monitor.y + 2 + off}
                width={Math.max(4, monitor.w - 4 - (off % 3) * 4)}
                height="1"
                fill={fillLine}
              />
            ) : (
              <rect
                key={off}
                x={monitor.x + 2 + off}
                y={monitor.y + 2}
                width="1"
                height={Math.max(4, monitor.h - 4 - (off % 3) * 4)}
                fill={fillLine}
              />
            ),
          )}
        {isWorking ? (
          <rect
            x={monitor.x - 2}
            y={monitor.y - 2}
            width={monitor.w + 4}
            height={monitor.h + 4}
            fill="#E95420"
            opacity="0.18"
          >
            <animate
              attributeName="opacity"
              values="0.10;0.30;0.10"
              dur="1.6s"
              repeatCount="indefinite"
            />
          </rect>
        ) : null}

        <rect x={keyboard.x} y={keyboard.y} width={keyboard.w} height={keyboard.h} fill="#2a2522" />
        <rect x={keyboard.x} y={keyboard.y} width={keyboard.w} height="1" fill="#5e5651" />
        {horizontalSide
          ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <rect
                key={i}
                x={keyboard.x + 2 + i * 3}
                y={keyboard.y + 2}
                width="2"
                height="2"
                fill="#8a8079"
              />
            ))
          : [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <rect
                key={i}
                x={keyboard.x + 2}
                y={keyboard.y + 2 + i * 3}
                width="2"
                height="2"
                fill="#8a8079"
              />
            ))}

        <rect x={mouse.x} y={mouse.y} width={mouse.w} height={mouse.h} fill="#2a2522" rx="1" />

        {agent.desk.plant ? <DeskPlant side={side} desk={desk} /> : <DeskMug side={side} desk={desk} color={shirtColor} />}

        {agent.desk.monitor >= 2 ? (
          <SecondaryMonitor monitor={monitor} side={side} working={isWorking} />
        ) : null}

        <PixChair x={chairPos.x} y={chairPos.y} dir={chairDir} color={shirtColor} />
      </svg>

      <div
        style={{
          ...TOPDOWN_AGENT_WRAP_BASE,
          left: agentPos.x,
          top: agentPos.y,
        }}
      >
        <TopDownAgent agent={agent} dir={agentPos.dir} working={isWorking} />
      </div>

      {showBubble ? (
        <div
          style={{
            ...BUBBLE_BASE,
            left: bubbleX,
            top: bubbleY,
            transform:
              bubbleAnchor === "middle"
                ? "translate(-50%, -100%)"
                : bubbleAnchor === "start"
                  ? "translate(0, -50%)"
                  : "translate(-100%, -50%)",
            border:
              "1px solid " +
              (isError ? "var(--error)" : isDone ? "var(--done)" : "rgba(233,84,32,0.5)"),
            color: isError ? "var(--error)" : isDone ? "var(--done)" : "var(--acc)",
          }}
        >
          <span
            style={{
              ...BUBBLE_DOT_BASE,
              background: isError ? "var(--error)" : isDone ? "var(--done)" : "var(--working)",
              animation: isWorking ? "pulseDot 1.6s infinite" : "none",
            }}
          />
          {isDone ? "✓ " : ""}
          {agent.task && agent.task.length > 22 ? agent.task.slice(0, 22) + "…" : agent.task}
        </div>
      ) : null}

      <div
        style={{
          ...NAME_PILL_BASE,
          left: chairPos.x,
          top: chairPos.y + 18,
          background: selected ? "var(--acc)" : "var(--bg-1)",
          color: selected ? "white" : "var(--txt-2)",
          border: selected ? "1px solid var(--acc)" : "1px solid var(--line)",
        }}
      >
        {agent.short}
      </div>

      {selected ? (
        <svg
          width={ROOM_W}
          height={ROOM_H}
          style={SVG_OVERLAY_STYLE}
        >
          <rect
            x={hitX}
            y={hitY}
            width={hitW}
            height={hitH - 20}
            fill="none"
            stroke="var(--acc)"
            strokeWidth="2"
            strokeDasharray="3 2"
            rx="3"
          />
        </svg>
      ) : null}

      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClick}
        className="workstation-hit"
        style={{
          ...HIT_BUTTON_BASE,
          left: hitX,
          top: hitY,
          width: hitW,
          height: hitH,
        }}
      />
    </div>
  );
}

export const Workstation = memo(WorkstationImpl);

function DeskPlant({ side, desk }: { side: Side; desk: Rect }) {
  let px = desk.x + desk.w - 14;
  let py = desk.y + 4;
  if (side === 2) {
    px = desk.x + 4;
    py = desk.y + desk.h - 14;
  } else if (side === 1) {
    px = desk.x + 4;
    py = desk.y + 4;
  } else if (side === 3) {
    px = desk.x + desk.w - 14;
    py = desk.y + desk.h - 14;
  }
  return (
    <g transform={`translate(${px},${py})`}>
      <rect x="2" y="6" width="6" height="4" fill="#8B5A3C" />
      <ellipse cx="5" cy="4" rx="5" ry="4" fill="#2C8B3E" />
      <ellipse cx="3" cy="2" rx="2" ry="3" fill="#3CB04A" />
    </g>
  );
}

function DeskMug({ side, desk, color }: { side: Side; desk: Rect; color: string }) {
  let mx = desk.x + desk.w - 12;
  let my = desk.y + 8;
  if (side === 2) {
    mx = desk.x + 6;
    my = desk.y + desk.h - 12;
  } else if (side === 1) {
    mx = desk.x + 6;
    my = desk.y + 8;
  } else if (side === 3) {
    mx = desk.x + desk.w - 12;
    my = desk.y + desk.h - 12;
  }
  return (
    <g>
      <circle cx={mx + 3} cy={my + 3} r="3.5" fill={color} />
      <circle cx={mx + 3} cy={my + 3} r="2" fill="#3a2510" />
    </g>
  );
}

function SecondaryMonitor({
  monitor,
  side,
  working,
}: {
  monitor: Rect;
  side: Side;
  working: boolean;
}) {
  const mm: Rect = { ...monitor };
  if (side === 0 || side === 2) {
    mm.x = monitor.x + 18;
    mm.w = 14;
  } else {
    mm.y = monitor.y + 18;
    mm.h = 14;
  }
  return (
    <>
      <rect x={mm.x - 1} y={mm.y - 1} width={mm.w + 2} height={mm.h + 2} fill="#1E1A18" />
      <rect x={mm.x} y={mm.y} width={mm.w} height={mm.h} fill={working ? "#0E8420" : "#2A2522"} />
    </>
  );
}
