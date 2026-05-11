"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  DECORATIONS,
  DECORATION_KINDS,
  type DecoCategory,
  type DecorationKind,
} from "./decorations";
import {
  GRASS_COLOR_LIST,
  type GrassColor,
  type GrassColorDef,
} from "./grass-colors";

export type BuildTool = "grass" | "erase" | DecorationKind;

export type OfficeBuildToolbarProps = {
  active: boolean;
  tool: BuildTool;
  grassColor: GrassColor;
  onToggle: () => void;
  onSelectTool: (next: BuildTool) => void;
  /** Single grass color per island — picking one re-skins every existing
   *  grass tile in place. No mid-island transitions. */
  onSelectGrassColor: (next: GrassColor) => void;
};

const CATEGORY_TABS: { id: DecoCategory; label: string }[] = [
  { id: "land", label: "Land" },
  { id: "buildings", label: "Buildings" },
  { id: "water", label: "Water" },
];

const SWATCH = 36; // px — icon-only thumbnail button side length
const COLS = 6;
// Show at most 5 rows before the panel scrolls. Land has 6 rows → tiny
// scroll. Buildings (3 rows) and Water (2 rows) fit without scrolling.
const PANEL_MAX_H = 5 * SWATCH + (5 - 1) * 6; // 204 px

/**
 * Floating builder UI for the office scene.
 *
 * Inactive → a single Build button in the bottom-right corner.
 * Active   → expands into a structured palette:
 *   • Terrain tools (Grass / Erase) — always visible, primary actions.
 *   • Island color swatches — always visible, island-level config.
 *   • Segmented category tabs (Land / Buildings / Water) — shows one
 *     category at a time so the panel stays a fixed, manageable height
 *     regardless of how many decoration kinds are added later.
 */
export function OfficeBuildToolbar({
  active,
  tool,
  grassColor,
  onToggle,
  onSelectTool,
  onSelectGrassColor,
}: OfficeBuildToolbarProps) {
  const [activeTab, setActiveTab] = useState<DecoCategory>("land");

  // Keep the visible tab in sync when a decoration tool is selected
  // externally (e.g. undo/redo or a keyboard shortcut that bypasses the
  // palette).
  useEffect(() => {
    const kind = tool as DecorationKind;
    if (DECORATION_KINDS.includes(kind)) {
      setActiveTab(DECORATIONS[kind].category);
    }
  }, [tool]);

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
          }}
        >
          {/* ── Pinned: Terrain tools ───────────────────────────────────── */}
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

          {/* ── Pinned: Island color ────────────────────────────────────── */}
          <Group label="Island color">
            {GRASS_COLOR_LIST.map((c) => (
              <GrassColorButton
                key={c.id}
                def={c}
                selected={grassColor === c.id}
                onClick={() => onSelectGrassColor(c.id)}
              />
            ))}
          </Group>

          {/* ── Visual separator before the tabbed section ─────────────── */}
          <div
            aria-hidden
            style={{
              height: 1,
              background: "var(--line)",
              margin: "0 -12px",
            }}
          />

          {/* ── Category tab bar ────────────────────────────────────────── */}
          <CategoryTabBar
            tabs={CATEGORY_TABS}
            active={activeTab}
            onChange={setActiveTab}
          />

          {/* ── Per-category decoration grid (scrolls independently) ────── */}
          <DecoPanel
            category={activeTab}
            tool={tool}
            onSelectTool={onSelectTool}
          />

          {/* ── Done ────────────────────────────────────────────────────── */}
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

// ─── Category tab bar ────────────────────────────────────────────────────────

function CategoryTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: DecoCategory; label: string }[];
  active: DecoCategory;
  onChange: (next: DecoCategory) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Standard ARIA tabs keyboard pattern: ←/→ moves focus AND selection.
  const move = (dir: -1 | 1, fromIdx: number) => {
    const next = (fromIdx + dir + tabs.length) % tabs.length;
    onChange(tabs[next]!.id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label="Decoration categories" style={{ display: "flex" }}>
      {tabs.map(({ id, label }, idx) => {
        const isActive = active === id;
        const isFirst = idx === 0;
        const isLast = idx === tabs.length - 1;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            role="tab"
            aria-selected={isActive}
            // Only the active tab is in the natural tab-stop sequence;
            // the others are reached with arrow keys per the ARIA pattern.
            tabIndex={isActive ? 0 : -1}
            type="button"
            onClick={() => onChange(id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); move(1, idx); }
              if (e.key === "ArrowLeft")  { e.preventDefault(); move(-1, idx); }
            }}
            style={{
              flex: 1,
              padding: "4px 0",
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: isActive ? 700 : 400,
              letterSpacing: "0.04em",
              background: isActive ? "var(--acc)" : "var(--bg-2)",
              color: isActive ? "white" : "var(--txt-2)",
              border: "1px solid",
              borderColor: isActive ? "var(--acc)" : "var(--line)",
              // Pill ends on first/last tab; shared border collapse in the middle.
              borderRadius: isFirst
                ? "5px 0 0 5px"
                : isLast
                  ? "0 5px 5px 0"
                  : 0,
              marginLeft: idx > 0 ? -1 : 0,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Per-category decoration panel ──────────────────────────────────────────

function DecoPanel({
  category,
  tool,
  onSelectTool,
}: {
  category: DecoCategory;
  tool: BuildTool;
  onSelectTool: (next: BuildTool) => void;
}) {
  const kinds = DECORATION_KINDS.filter(
    (k) => DECORATIONS[k].category === category,
  );
  const tabLabel =
    CATEGORY_TABS.find((t) => t.id === category)?.label ?? category;

  return (
    <div
      role="tabpanel"
      aria-label={tabLabel}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, ${SWATCH}px)`,
        gap: 6,
        maxHeight: PANEL_MAX_H,
        overflowY: "auto",
      }}
    >
      {kinds.map((kind) => (
        <DecoButton
          key={kind}
          kind={kind}
          selected={tool === kind}
          onClick={() => onSelectTool(kind)}
        />
      ))}
    </div>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────────────

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
          maxWidth: `calc(${SWATCH}px * ${COLS} + ${(COLS - 1) * 6}px)`,
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

/**
 * Swatch that previews a single color variant. Renders the interior
 * grass tile (col 1, row 1 in the 9×6 sheet — `lt_m`) cropped to fit the
 * swatch square, so the user sees the actual texture and hue, not an
 * approximated hex chip.
 */
function GrassColorButton({
  def,
  selected,
  onClick,
}: {
  def: GrassColorDef;
  selected: boolean;
  onClick: () => void;
}) {
  // Center-tile (col 1, row 1) cropped from the 9×6 tileset, scaled to
  // fit the swatch. Source tile is 64px; we render it at `inner`.
  const inner = SWATCH - 4; // 2-px gutter on every side
  const sheetW = 9 * inner;
  const sheetH = 6 * inner;
  return (
    <button
      type="button"
      onClick={onClick}
      title={def.label}
      style={{
        ...swatchBase,
        background: selected ? "var(--acc-faint)" : "var(--bg-2)",
        borderColor: selected ? "var(--acc)" : "var(--line)",
        position: "relative",
      }}
      aria-pressed={selected}
      aria-label={`Island color: ${def.label}${selected ? " (selected)" : ""}`}
    >
      <span
        aria-hidden
        style={{
          width: inner,
          height: inner,
          backgroundImage: `url(${def.src})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${sheetW}px ${sheetH}px`,
          backgroundPosition: `-${inner}px -${inner}px`,
          imageRendering: "pixelated",
          borderRadius: 4,
        }}
      />
    </button>
  );
}

// ─── Shared style tokens ─────────────────────────────────────────────────────

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
