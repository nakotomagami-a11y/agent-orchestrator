"use client";

import { Icon } from "@/components/ui/icon";
import {
  DECORATIONS,
  DECORATION_KINDS,
  type DecoCategory,
  type DecorationKind,
} from "./decorations";

export type BuildTool = "grass" | "erase" | DecorationKind;

export type OfficeBuildToolbarProps = {
  active: boolean;
  tool: BuildTool;
  onToggle: () => void;
  onSelectTool: (next: BuildTool) => void;
};

const CATEGORY_ORDER: { id: DecoCategory; label: string }[] = [
  { id: "land", label: "Land" },
  { id: "buildings", label: "Buildings" },
  { id: "water", label: "Water" },
];

const SWATCH = 36; // px — icon-only thumbnail button side length

/**
 * Floating builder UI for the office scene. Inactive: a single Build
 * button bottom-right. Active: expands into a palette grouped by
 * category. Terrain tools have text labels; decoration variants are
 * icon-only with tooltips so the palette stays compact even with 20+
 * variants.
 */
export function OfficeBuildToolbar({
  active,
  tool,
  onToggle,
  onSelectTool,
}: OfficeBuildToolbarProps) {
  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        bottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-end",
        zIndex: 10,
      }}
    >
      {active ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: 12,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            boxShadow: "var(--shadow-2)",
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          <Group label="Terrain">
            <ToolButton
              label="Grass"
              iconName="plus"
              selected={tool === "grass"}
              onClick={() => onSelectTool("grass")}
            />
            <ToolButton
              label="Erase"
              iconName="x"
              selected={tool === "erase"}
              onClick={() => onSelectTool("erase")}
            />
          </Group>

          {CATEGORY_ORDER.map(({ id, label }) => {
            const kinds = DECORATION_KINDS.filter(
              (k) => DECORATIONS[k].category === id,
            );
            if (kinds.length === 0) return null;
            return (
              <Group key={id} label={label}>
                {kinds.map((kind) => (
                  <DecoButton
                    key={kind}
                    kind={kind}
                    selected={tool === kind}
                    onClick={() => onSelectTool(kind)}
                  />
                ))}
              </Group>
            );
          })}

          <button
            type="button"
            onClick={onToggle}
            style={{
              ...buttonBase,
              alignSelf: "flex-end",
              borderColor: "var(--line)",
              color: "var(--txt-3)",
            }}
            title="Exit build mode"
          >
            Done
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onToggle}
        style={{
          ...buttonBase,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 600,
          background: active ? "var(--acc)" : "var(--bg-1)",
          color: active ? "white" : "var(--txt)",
          borderColor: active ? "var(--acc)" : "var(--line)",
          boxShadow: "var(--shadow-2)",
        }}
        aria-pressed={active}
      >
        <Icon name="edit" size={13} />
        <span style={{ marginLeft: 6 }}>{active ? "Stop building" : "Build"}</span>
      </button>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--txt-3)",
          marginBottom: 6,
          paddingLeft: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, ${SWATCH}px)`,
          gap: 6,
          maxWidth: `calc(${SWATCH}px * 6 + 30px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ToolButton({
  label,
  iconName,
  selected,
  onClick,
}: {
  label: string;
  iconName: "plus" | "x";
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      style={{
        ...swatchBase,
        background: selected ? "var(--acc-faint)" : "var(--bg-2)",
        borderColor: selected ? "var(--acc)" : "var(--line)",
        color: selected ? "var(--acc)" : "var(--txt)",
      }}
      aria-pressed={selected}
      aria-label={label}
    >
      <Icon name={iconName} size={14} />
    </button>
  );
}

function DecoButton({
  kind,
  selected,
  onClick,
}: {
  kind: DecorationKind;
  selected: boolean;
  onClick: () => void;
}) {
  const def = DECORATIONS[kind];
  // Show frame 0 of the sprite, scaled so the entire frame fits in the
  // 36-px swatch. `contain` semantics via background-size.
  const innerPad = 4;
  const inner = SWATCH - innerPad * 2;
  const scale = Math.min(inner / def.frameW, inner / def.frameH);
  const drawW = def.frameW * scale;
  const drawH = def.frameH * scale;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${def.label} — ${def.terrain}-only`}
      style={{
        ...swatchBase,
        background: selected ? "var(--acc-faint)" : "var(--bg-2)",
        borderColor: selected ? "var(--acc)" : "var(--line)",
        position: "relative",
      }}
      aria-pressed={selected}
      aria-label={def.label}
    >
      <span
        aria-hidden
        style={{
          width: drawW,
          height: drawH,
          backgroundImage: `url(${def.src})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${def.frames * drawW}px ${drawH}px`,
          backgroundPosition: "0 0",
          imageRendering: "pixelated",
        }}
      />
    </button>
  );
}

const buttonBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  background: "var(--bg-1)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 11.5,
  color: "var(--txt)",
};

const swatchBase: React.CSSProperties = {
  width: SWATCH,
  height: SWATCH,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg-2)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  cursor: "pointer",
  padding: 0,
};
