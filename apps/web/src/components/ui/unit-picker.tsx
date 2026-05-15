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
    <div className="flex flex-col gap-[6px]">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${UNIT_KINDS.length}, 1fr)` }}
      >
        {/* Column headers (kind labels) */}
        <div
          className="grid gap-1 pl-0"
          style={{ gridColumn: `span ${UNIT_KINDS.length}`, gridTemplateColumns: `repeat(${UNIT_KINDS.length}, 1fr)` }}
        >
          {UNIT_KINDS.map((kind) => (
            <div key={kind} className="text-[9px] font-[var(--font-mono)] uppercase text-[var(--txt-4)] text-center tracking-[0.05em]">
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
                  border: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  background: isActive ? "var(--bg-2)" : "transparent",
                }}
                className="p-[3px] rounded-[6px] cursor-pointer flex items-center justify-center transition-[border-color,background] duration-100"
              >
                <AgentAvatar unit={sel} size={26} />
              </button>
            );
          })
        ))}
      </div>

      {/* Row labels on the left would need a more complex grid; instead show selected state as text */}
      <div className="flex items-center gap-[6px] text-[11px] text-[var(--txt-3)] font-[var(--font-mono)]">
        {current ? (
          <>
            <AgentAvatar unit={current} size={16} />
            <span>{FACTION_LABELS[current.faction]} {UNIT_DEFS[current.kind].label}</span>
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-[10px] text-[var(--txt-4)] bg-none border-none cursor-pointer px-[2px]"
            >
              × auto
            </button>
          </>
        ) : (
          <span className="text-[var(--txt-4)]">auto (derived from name)</span>
        )}
      </div>
    </div>
  );
}
