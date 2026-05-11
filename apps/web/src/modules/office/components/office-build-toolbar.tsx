"use client";

import { Icon } from "@/components/ui/icon";
import { DECORATIONS, type DecorationKind } from "./decorations";

export type BuildTool = "grass" | "erase" | DecorationKind;

export type OfficeBuildToolbarProps = {
  active: boolean;
  tool: BuildTool;
  onToggle: () => void;
  onSelectTool: (next: BuildTool) => void;
};

/**
 * Floating builder UI for the office scene. Inactive: a single Build
 * button bottom-right. Active: expands into a palette grouped by
 * category — terrain (grass/erase), land decorations, water decorations.
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
            gap: 8,
            padding: 10,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            boxShadow: "var(--shadow-2)",
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            minWidth: 240,
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

          <Group label="Land">
            {(["bush", "rock", "tree"] as const).map((kind) => (
              <DecoButton
                key={kind}
                kind={kind}
                selected={tool === kind}
                onClick={() => onSelectTool(kind)}
              />
            ))}
          </Group>

          <Group label="Water">
            {(["water_rock", "duck"] as const).map((kind) => (
              <DecoButton
                key={kind}
                kind={kind}
                selected={tool === kind}
                onClick={() => onSelectTool(kind)}
              />
            ))}
          </Group>

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
          marginBottom: 4,
          paddingLeft: 2,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
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
      style={{
        ...buttonBase,
        background: selected ? "var(--acc-faint)" : "var(--bg-2)",
        borderColor: selected ? "var(--acc)" : "var(--line)",
        color: selected ? "var(--acc)" : "var(--txt)",
        fontWeight: selected ? 600 : 400,
      }}
      aria-pressed={selected}
    >
      <Icon name={iconName} size={11} />
      <span style={{ marginLeft: 4 }}>{label}</span>
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
  // Show a small thumbnail of frame 0 of the decoration sprite. Scale the
  // sheet so a single frame fits in the 22px swatch.
  const swatch: React.CSSProperties = {
    width: 22,
    height: 22,
    backgroundImage: `url(${def.src})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${(22 / def.frameH) * def.frameW}px 22px`,
    backgroundPosition: "0 0",
    imageRendering: "pixelated",
    flexShrink: 0,
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${def.label} — ${def.terrain}-only`}
      style={{
        ...buttonBase,
        background: selected ? "var(--acc-faint)" : "var(--bg-2)",
        borderColor: selected ? "var(--acc)" : "var(--line)",
        color: selected ? "var(--acc)" : "var(--txt)",
        fontWeight: selected ? 600 : 400,
        gap: 6,
      }}
      aria-pressed={selected}
    >
      <span aria-hidden style={swatch} />
      {def.label}
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
