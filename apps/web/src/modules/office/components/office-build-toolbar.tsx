"use client";

import { Icon } from "@/components/ui/icon";

export type BuildTool = "grass" | "erase";

export type OfficeBuildToolbarProps = {
  active: boolean;
  tool: BuildTool;
  onToggle: () => void;
  onSelectTool: (next: BuildTool) => void;
};

/**
 * Floating builder UI for the office scene. When inactive it's a single
 * "Build" button in the bottom-right; when active it expands into a
 * palette of place/erase tools. State lives in OfficeScene — this
 * component is presentational.
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
            gap: 6,
            padding: 6,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            boxShadow: "var(--shadow-2)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
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
          <button
            type="button"
            onClick={onToggle}
            style={{
              ...buttonBase,
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

const buttonBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  background: "var(--bg-1)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
  color: "var(--txt)",
};
