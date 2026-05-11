"use client";

import type { OfficeAgent } from "../../hooks/use-office-agents";
import { PODS, ROOM_W, ROOM_H, type Side } from "./constants";
import { CoffeeCorner, CubiclePod, FloorPlan, MeetingRoom, PlantStrips } from "./floor-plan";
import { Workstation } from "./workstation";
import { Details } from "./details";

/**
 * Top-down pixel office: 4 cubicle pods pinwheel around a hallway, with a
 * meeting room, lounge, plant strips, and scattered details. Each agent owns
 * one of 16 seats derived from `agent.desk.{tier, slot}`.
 */

export type IsoOfficeProps = {
  agents: OfficeAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  zoom: number;
};

const STAGE_BASE_STYLE = {
  position: "relative" as const,
  imageRendering: "pixelated" as const,
};

export function IsoOffice({ agents, selectedId, onSelect, zoom }: IsoOfficeProps) {
  return (
    <div className="office-canvas">
      <div
        className="topdown-stage"
        style={{
          ...STAGE_BASE_STYLE,
          width: ROOM_W,
          height: ROOM_H,
          transform: `scale(${zoom})`,
        }}
      >
        <FloorPlan />
        <MeetingRoom />
        <CoffeeCorner />
        <PlantStrips />

        {PODS.map((p, i) => (
          <CubiclePod key={i} cx={p.cx} cy={p.cy} />
        ))}

        {agents.map((a) => {
          const podIdx = a.desk.tier % PODS.length;
          const pod = PODS[podIdx]!;
          const side = (a.desk.slot % 4) as Side;
          return (
            <Workstation
              key={a.id}
              agent={a}
              cx={pod.cx}
              cy={pod.cy}
              side={side}
              selected={selectedId === a.id}
              onClick={() => onSelect(a.id)}
            />
          );
        })}

        <Details />
      </div>
    </div>
  );
}
