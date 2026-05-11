"use client";

import { PixelSprite } from "@/components/ui/pixel-sprite";
import { cn } from "@/lib/cn";
import type { OfficeAgent } from "../hooks/use-office-agents";

export type DeskWithAgentProps = {
  agent: OfficeAgent;
  x: number;
  y: number;
  selected: boolean;
  onClick: () => void;
};

export function DeskWithAgent({ agent, x, y, selected, onClick }: DeskWithAgentProps) {
  const isWorking = agent.status === "working" || agent.status === "thinking";
  const showDoneBubble = agent.status === "done" && agent.task;

  return (
    <button
      type="button"
      className={cn("desk", selected && "selected")}
      style={{ left: x, top: y, position: "absolute", border: "none", background: "transparent", padding: 0 }}
      onClick={onClick}
      aria-label={`${agent.name} (${agent.status})`}
    >
      {isWorking && agent.task ? (
        <span className={cn("bubble", agent.status)}>
          <span className="dot" />
          <span>{agent.task}</span>
        </span>
      ) : null}
      {showDoneBubble ? (
        <span className="bubble done">
          <span className="dot" />
          <span>✓ {agent.taskKind ?? "done"}</span>
        </span>
      ) : null}

      <svg width="96" height="96" viewBox="0 0 96 96" style={{ position: "absolute", left: 0, top: 8 }} aria-hidden>
        <polygon points="48,30 86,49 48,68 10,49" fill="#5E4632" stroke="#3a2a1d" strokeWidth="1" />
        <polygon points="48,30 86,49 48,68 10,49" fill="#7A5A40" opacity="0.4" />
        <rect x="14" y="49" width="2" height="22" fill="#3a2a1d" />
        <rect x="80" y="49" width="2" height="22" fill="#3a2a1d" />
        <rect x="46" y="65" width="2" height="22" fill="#3a2a1d" />

        <g transform={agent.desk.monitor >= 2 ? "translate(-10, 0)" : ""}>
          <polygon points="48,16 64,24 48,32 32,24" fill="#1E1A18" />
          <polygon points="48,18 62,24 48,30 34,24" fill={isWorking ? "#2C001E" : "#3a3530"} />
          {isWorking ? (
            <>
              <rect x="38" y="22" width="20" height="1" fill="#E95420" opacity="0.8" />
              <rect x="38" y="25" width="14" height="1" fill="#F5814C" opacity="0.6" />
              <rect x="38" y="27" width="17" height="1" fill="#E95420" opacity="0.5" />
            </>
          ) : null}
        </g>
        {agent.desk.monitor >= 2 ? (
          <g transform="translate(14, 0)">
            <polygon points="48,16 64,24 48,32 32,24" fill="#1E1A18" />
            <polygon points="48,18 62,24 48,30 34,24" fill={isWorking ? "#2C001E" : "#3a3530"} />
            {isWorking ? <rect x="38" y="22" width="20" height="6" fill="#0E8420" opacity="0.5" /> : null}
          </g>
        ) : null}

        {agent.desk.plant ? (
          <g transform="translate(70, 36)">
            <rect x="0" y="6" width="6" height="6" fill="#8B5A3C" />
            <ellipse cx="3" cy="4" rx="5" ry="4" fill="#2C8B3E" />
            <ellipse cx="0" cy="2" rx="2" ry="3" fill="#3CB04A" />
          </g>
        ) : null}

        <rect x="40" y="50" width="16" height="3" fill="#1E1A18" opacity="0.6" />
      </svg>

      <div
        style={{
          position: "absolute",
          left: 30,
          top: -16,
          width: 36,
          height: 48,
          pointerEvents: "none",
        }}
      >
        <PixelSprite agent={agent} size={36} action={isWorking ? "typing" : "idle"} />
      </div>

      <span className="desk-name">{agent.short}</span>
    </button>
  );
}
