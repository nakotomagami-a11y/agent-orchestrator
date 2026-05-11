"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { UnitSprite } from "@/components/ui/unit-sprite";
import {
  FACTION_LABELS,
  UNIT_DEFS,
  UNIT_FACTIONS,
  UNIT_KINDS,
  formatUnit,
  parseUnit,
  unitForAgent,
  type UnitFaction,
  type UnitKind,
} from "@/components/ui/unit-sprite.utils";

export type UnitPickerProps = {
  /** Current value as `"<faction>/<kind>"`, or empty for auto. */
  value: string;
  onChange: (next: string) => void;
  /** Agent name used to preview the auto pick. */
  previewName: string;
};

/**
 * Two-axis picker: pick a faction (colour) and a unit kind. Empty value means
 * "Auto from name" — the avatar then falls back to the deterministic hash.
 */
export function UnitPicker({ value, onChange, previewName }: UnitPickerProps) {
  const t = useTranslations();
  const parsed = useMemo(() => parseUnit(value), [value]);
  const isAuto = !parsed;
  const auto = useMemo(() => unitForAgent(previewName), [previewName]);

  const current = parsed ?? auto;

  const setFaction = (faction: UnitFaction) => {
    onChange(formatUnit({ faction, kind: current.kind }));
  };
  const setKind = (kind: UnitKind) => {
    onChange(formatUnit({ faction: current.faction, kind }));
  };
  const clear = () => onChange("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 12,
          border: "1px solid var(--line)",
          borderRadius: "var(--r-md)",
          background: "var(--bg-1)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-2)",
            borderRadius: "var(--r-sm)",
            flexShrink: 0,
          }}
        >
          <UnitSprite
            unit={current}
            size={56}
            animate
            label={t("unit_picker.preview_aria", {
              faction: FACTION_LABELS[current.faction],
              kind: UNIT_DEFS[current.kind].label,
            })}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {FACTION_LABELS[current.faction]} {UNIT_DEFS[current.kind].label}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--txt-3)" }}>
            {isAuto ? t("unit_picker.auto_hint") : t("unit_picker.custom_hint")}
          </div>
        </div>
        {!isAuto ? (
          <button
            type="button"
            className="btn sm ghost"
            onClick={clear}
            aria-label={t("unit_picker.reset_aria")}
          >
            {t("unit_picker.reset")}
          </button>
        ) : null}
      </div>

      <fieldset
        style={{
          border: "1px solid var(--line)",
          borderRadius: "var(--r-md)",
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <legend
          style={{
            fontSize: 11,
            color: "var(--txt-3)",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "0 4px",
          }}
        >
          {t("unit_picker.faction_legend")}
        </legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {UNIT_FACTIONS.map((f) => (
            <FactionChip
              key={f}
              faction={f}
              active={current.faction === f}
              onSelect={() => setFaction(f)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset
        style={{
          border: "1px solid var(--line)",
          borderRadius: "var(--r-md)",
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <legend
          style={{
            fontSize: 11,
            color: "var(--txt-3)",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "0 4px",
          }}
        >
          {t("unit_picker.kind_legend")}
        </legend>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
            gap: 8,
          }}
        >
          {UNIT_KINDS.map((k) => (
            <KindTile
              key={k}
              kind={k}
              faction={current.faction}
              active={current.kind === k}
              onSelect={() => setKind(k)}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function FactionChip({
  faction,
  active,
  onSelect,
}: {
  faction: UnitFaction;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px 5px 6px",
        borderRadius: 999,
        border: `1px solid ${active ? "var(--acc)" : "var(--line)"}`,
        background: active ? "var(--acc-faint)" : "var(--bg-1)",
        color: active ? "var(--acc)" : "var(--txt-2)",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: FACTION_SWATCH[faction],
          border: "1px solid var(--line)",
          display: "inline-block",
        }}
      />
      {FACTION_LABELS[faction]}
    </button>
  );
}

function KindTile({
  kind,
  faction,
  active,
  onSelect,
}: {
  kind: UnitKind;
  faction: UnitFaction;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title={UNIT_DEFS[kind].label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: 6,
        borderRadius: "var(--r-sm)",
        border: `1px solid ${active ? "var(--acc)" : "var(--line)"}`,
        background: active ? "var(--acc-faint)" : "var(--bg-1)",
        color: active ? "var(--acc)" : "var(--txt-2)",
        fontFamily: "inherit",
        fontSize: 11.5,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-2)",
          borderRadius: "var(--r-sm)",
        }}
      >
        <UnitSprite unit={{ faction, kind }} size={44} animate />
      </div>
      {UNIT_DEFS[kind].label}
    </button>
  );
}

// Approximate swatch colours; only used as a colour cue beside the faction
// name (the text label is the source of truth — see a11y rules).
const FACTION_SWATCH: Record<UnitFaction, string> = {
  blue: "#3b6cc4",
  red: "#c83a3a",
  purple: "#7d2dbe",
  yellow: "#d6a64a",
  black: "#2a2a30",
};
