"use client";

import { FloorSvg } from "./floor-svg";
import { Decor } from "./decor";
import { DeskWithAgent } from "./desk-with-agent";
import { stageDimensions } from "../utils/iso-coords";
import { deskPosition } from "../utils/desk-layout";
import type { OfficeAgent } from "../hooks/use-office-agents";

export type IsoOfficeProps = {
  agents: OfficeAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  zoom: number;
};

export function IsoOffice({ agents, selectedId, onSelect, zoom }: IsoOfficeProps) {
  const { width, height } = stageDimensions();
  return (
    <div className="office-canvas">
      <div
        className="iso-stage"
        style={{
          width,
          height,
          transform: `scale(${zoom})`,
        }}
      >
        <FloorSvg />
        <Decor />
        {agents.map((a) => {
          const pos = deskPosition(a.desk.tier, a.desk.slot);
          return (
            <DeskWithAgent
              key={a.id}
              agent={a}
              x={pos.x}
              y={pos.y}
              selected={selectedId === a.id}
              onClick={() => onSelect(a.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
