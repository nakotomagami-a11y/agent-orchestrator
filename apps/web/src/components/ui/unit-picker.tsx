"use client";

import { AgentAvatar } from "./agent-avatar";
import {
  UNIT_FACTIONS,
  UNIT_KINDS,
  FACTION_LABELS,
  UNIT_DEFS,
  parseUnit,
  formatUnit,
  type UnitSelection,
} from "./unit-sprite.utils";

export type UnitPickerProps = {
  /** Current value in `"faction/kind"` format, or empty string for auto. */
  value: string;
  onChange: (value: string) => void;
  /** Name used to compute the auto-selection preview. */
  agentName?: string;
};

export function UnitPicker({ value, onChange, agentName: _agentName }: UnitPickerProps) {
  const current = parseUnit(value);

  const toggle = (sel: UnitSelection) => {
    const next = formatUnit(sel);
    onChange(current && formatUnit(current) === next ? "" : next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${UNIT_KINDS.length}, 1fr)`,
        gap: 4,
      }}>
        {/* Column headers (kind labels) */}
        <div style={{ gridColumn: `span ${UNIT_KINDS.length}`, display: "grid", gridTemplateColumns: `repeat(${UNIT_KINDS.length}, 1fr)`, gap: 4, paddingLeft: 0 }}>
          {UNIT_KINDS.map((kind) => (
            <div key={kind} style={{
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              color: "var(--txt-4)",
              textAlign: "center",
              letterSpacing: "0.05em",
            }}>
              {UNIT_DEFS[kind].label}
            </div>
          ))}
        </div>

        {UNIT_FACTIONS.map((faction) => (
          UNIT_KINDS.map((kind) => {
            const sel: UnitSelection = { faction, kind };
            const isActive = !!(current && current.faction === faction && current.kind === kind);
            return (
              <button
                key={`${faction}/${kind}`}
                type="button"
                title={`${FACTION_LABELS[faction]} ${UNIT_DEFS[kind].label}`}
                onClick={() => toggle(sel)}
                style={{
                  padding: 3,
                  border: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  borderRadius: 6,
                  background: isActive ? "var(--bg-2)" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "border-color 100ms, background 100ms",
                }}
              >
                <AgentAvatar unit={sel} size={26} />
              </button>
            );
          })
        ))}
      </div>

      {/* Row labels on the left would need a more complex grid; instead show selected state as text */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--txt-3)", fontFamily: "var(--font-mono)" }}>
        {current ? (
          <>
            <AgentAvatar unit={current} size={16} />
            <span>{FACTION_LABELS[current.faction]} {UNIT_DEFS[current.kind].label}</span>
            <button
              type="button"
              onClick={() => onChange("")}
              style={{ fontSize: 10, color: "var(--txt-4)", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
            >
              × auto
            </button>
          </>
        ) : (
          <span style={{ color: "var(--txt-4)" }}>auto (derived from name)</span>
        )}
      </div>
    </div>
  );
}
