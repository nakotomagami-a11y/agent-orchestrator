"use client";

import { UnitSprite } from "@/components/ui/unit-sprite";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/cn";
import type { OfficeAgent } from "../hooks/use-office-agents";

export type CardsOfficeProps = {
  agents: OfficeAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function CardsOffice({ agents, selectedId, onSelect }: CardsOfficeProps) {
  return (
    <ul className="cards-office" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {agents.map((a) => {
        return (
          <li key={a.id}>
          <button
            type="button"
            className={cn("desk-card", selectedId === a.id && "selected")}
            onClick={() => onSelect(a.id)}
            style={{ textAlign: "left", border: "1px solid var(--line)", background: "var(--bg-1)", width: "100%" }}
          >
            <div className="dc-h">
              <div className="av">
                <UnitSprite unit={a.unitChoice} size={40} action="idle" animate={false} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="dc-name">{a.name}</div>
                <div className="dc-id">{a.id}</div>
              </div>
              <StatusDot status={a.status} />
            </div>
            <div className="dc-task" title={a.task ?? "Idle — ready when you are"}>
              {a.task ?? "Idle — ready when you are"}
            </div>
            <div className="dc-meta">
              <span>
                {a.defaultModel ?? "default"} · {a.defaultEffort ?? "default"}
              </span>
              <span>{a.skills.map((s) => `#${s}`).join(" ")}</span>
            </div>
          </button>
          </li>
        );
      })}
    </ul>
  );
}
