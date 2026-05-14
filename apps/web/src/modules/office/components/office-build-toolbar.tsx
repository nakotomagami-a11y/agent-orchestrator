"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  DECORATIONS,
  DECORATION_KINDS,
  type DecoCategory,
  type DecorationDef,
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
  onSelectGrassColor: (next: GrassColor) => void;
};

const CATEGORY_TABS: { id: DecoCategory; label: string }[] = [
  { id: "land", label: "Land" },
  { id: "buildings", label: "Buildings" },
  { id: "water", label: "Water" },
];

export function OfficeBuildToolbar({
  active,
  tool,
  grassColor,
  onToggle,
  onSelectTool,
  onSelectGrassColor,
}: OfficeBuildToolbarProps) {
  const [activeTab, setActiveTab] = useState<DecoCategory>("land");
  const [q, setQ] = useState("");

  // Keep tab in sync when a deco tool is selected externally
  useEffect(() => {
    const kind = tool as DecorationKind;
    if (DECORATION_KINDS.includes(kind)) {
      setActiveTab(DECORATIONS[kind].category);
    }
  }, [tool]);

  const grassColorDef = GRASS_COLOR_LIST.find((c) => c.id === grassColor);

  const filteredKinds = useMemo(() => {
    if (q.trim()) {
      const s = q.toLowerCase();
      return DECORATION_KINDS.filter(
        (k) =>
          DECORATIONS[k].label.toLowerCase().includes(s) ||
          DECORATIONS[k].category.includes(s) ||
          DECORATIONS[k].family.includes(s),
      );
    }
    return DECORATION_KINDS.filter((k) => DECORATIONS[k].category === activeTab);
  }, [q, activeTab]);

  const searchGroups = useMemo(() => {
    if (!q.trim()) return null;
    const map = new Map<string, DecorationKind[]>();
    for (const k of filteredKinds) {
      const cat = DECORATIONS[k].category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(k);
    }
    return [...map.entries()] as [string, DecorationKind[]][];
  }, [q, filteredKinds]);

  const selectedKind = DECORATION_KINDS.includes(tool as DecorationKind)
    ? (tool as DecorationKind)
    : null;
  const selectedDef = selectedKind ? DECORATIONS[selectedKind] : null;

  if (!active) {
    return (
      <button
        type="button"
        className="build-entry-btn"
        onClick={onToggle}
        aria-label="Enter build mode"
      >
        <Icon name="hammer" size={13} />
        Build
      </button>
    );
  }

  return (
    <div className="build-panel">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="bp-head">
        <div className="bp-head-top">
          <div className="bp-head-crest">
            <Icon name="hammer" size={14} />
          </div>
          <div>
            <div className="bp-head-title">Build</div>
            <div className="bp-head-sub">painting decor · agent-office</div>
          </div>
          <button type="button" className="bp-help-btn" title="Help">
            <Icon name="help-circle" size={13} />
          </button>
        </div>
        <div className="bp-tools">
          <button
            type="button"
            className={`bp-tool ${tool === "grass" ? "active" : ""}`}
            onClick={() => onSelectTool("grass")}
            title="Paint terrain (B)"
          >
            <Icon name="pen" size={16} />
            <span className="bp-tool-label">paint</span>
            <span className="bp-tool-kbd">B</span>
          </button>
          <button
            type="button"
            className={`bp-tool ${tool === "erase" ? "active" : ""}`}
            onClick={() => onSelectTool("erase")}
            title="Erase (E)"
          >
            <Icon name="trash" size={16} />
            <span className="bp-tool-label">erase</span>
            <span className="bp-tool-kbd">E</span>
          </button>
        </div>
      </div>

      {/* ── Island color ────────────────────────────────────────────── */}
      <div className="biome-row">
        <div className="biome-row-head">
          Island color
          {grassColorDef && <span className="v">· {grassColorDef.label}</span>}
        </div>
        <div className="biome-swatches">
          {GRASS_COLOR_LIST.map((c) => (
            <GrassColorSwatch
              key={c.id}
              def={c}
              selected={grassColor === c.id}
              onClick={() => onSelectGrassColor(c.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Search ──────────────────────────────────────────────────── */}
      <div className="bp-search-wrap">
        <div className="bp-search">
          <Icon name="search" size={13} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tiles…"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: "var(--txt-3)", padding: 0 }}
            >
              <Icon name="x" size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── Category tabs ───────────────────────────────────────────── */}
      {!q && (
        <div className="bp-cats" role="tablist" aria-label="Tile categories">
          {CATEGORY_TABS.map(({ id, label }) => {
            const count = DECORATION_KINDS.filter((k) => DECORATIONS[k].category === id).length;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                className={`bp-cat ${activeTab === id ? "active" : ""}`}
                onClick={() => setActiveTab(id)}
              >
                {label}
                <span className="count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Tile grid ───────────────────────────────────────────────── */}
      <div className="bp-tiles" role="tabpanel">
        {q.trim() ? (
          searchGroups && searchGroups.length > 0 ? (
            searchGroups.map(([cat, kinds]) => (
              <div key={cat} style={{ display: "contents" }}>
                <div className="bp-section-head" style={{ textTransform: "capitalize" }}>
                  {cat}<span className="line" />
                </div>
                {kinds.map((kind) => (
                  <DecoTileCell
                    key={kind}
                    kind={kind}
                    selected={tool === kind}
                    onSelect={onSelectTool}
                  />
                ))}
              </div>
            ))
          ) : (
            <div className="bp-tiles-empty">No tiles match &ldquo;{q}&rdquo;</div>
          )
        ) : (
          filteredKinds.map((kind) => (
            <DecoTileCell
              key={kind}
              kind={kind}
              selected={tool === kind}
              onSelect={onSelectTool}
            />
          ))
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="bp-foot">
        <div className="bp-foot-row">
          <div className="bp-foot-preview">
            {selectedDef ? (
              <DecoSprite def={selectedDef} size={28} />
            ) : (
              <span style={{ color: "var(--txt-4)", fontSize: 18 }}>·</span>
            )}
          </div>
          <div className="bp-foot-info">
            <div className="name">{selectedDef?.label ?? "no selection"}</div>
            <div className="meta">
              {selectedDef ? (
                <>
                  <span>{selectedDef.category}</span>
                  <span className="sep">·</span>
                  <span>{selectedDef.family}</span>
                  <span className="sep">·</span>
                  <span>{selectedKind}</span>
                </>
              ) : (
                "pick a tile from the palette"
              )}
            </div>
          </div>
          <div className="bp-foot-actions">
            <button type="button" title="Pin tile">
              <Icon name="pin" size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DecoTileCell({
  kind,
  selected,
  onSelect,
}: {
  kind: DecorationKind;
  selected: boolean;
  onSelect: (k: BuildTool) => void;
}) {
  const def = DECORATIONS[kind];
  return (
    <button
      type="button"
      className={`tile-cell ${selected ? "active" : ""}`}
      onClick={() => onSelect(kind)}
      title={`${def.label} · ${def.terrain}-only`}
      aria-pressed={selected}
    >
      <DecoSprite def={def} size={32} />
      <div className="lbl">{def.label}</div>
    </button>
  );
}

function DecoSprite({ def, size }: { def: DecorationDef; size: number }) {
  const scale = Math.min(size / def.frameW, size / def.frameH);
  const drawW = def.frameW * scale;
  const drawH = def.frameH * scale;
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width: drawW,
        height: drawH,
        backgroundImage: `url(${def.src})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${def.frames * drawW}px ${drawH}px`,
        backgroundPosition: "0 0",
        imageRendering: "pixelated",
        flexShrink: 0,
      }}
    />
  );
}

function GrassColorSwatch({
  def,
  selected,
  onClick,
}: {
  def: GrassColorDef;
  selected: boolean;
  onClick: () => void;
}) {
  // CSS sprite trick: background-size 900%×600% (9 cols × 6 rows) makes one tile
  // fill the element exactly at any dimensions. Position 12.5% 20% → tile [1,1]
  // (first interior row/col), which shows the solid interior grass texture.
  return (
    <button
      type="button"
      onClick={onClick}
      title={def.label}
      className={`biome-swatch ${selected ? "active" : ""}`}
      aria-pressed={selected}
      aria-label={`Island color: ${def.label}`}
      style={{
        backgroundImage: `url(${def.src})`,
        backgroundSize: "900% 600%",
        backgroundPosition: "12.5% 20%",
        imageRendering: "pixelated",
      }}
    />
  );
}
