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
import { useFilter } from "@/hooks/use-filter";

export type BuildTool = "grass" | "erase" | "fill" | DecorationKind;

export type OfficeBuildToolbarProps = {
  active: boolean;
  tool: BuildTool | null;
  grassColor: GrassColor;
  onToggle: () => void;
  onSelectTool: (next: BuildTool | null) => void;
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

  // Keep tab in sync when a deco tool is selected externally
  useEffect(() => {
    if (!tool || tool === "grass" || tool === "erase" || tool === "fill") return;
    const kind = tool as DecorationKind;
    if (DECORATION_KINDS.includes(kind)) {
      setActiveTab(DECORATIONS[kind].category);
    }
  }, [tool]);

  const grassColorDef = GRASS_COLOR_LIST.find((c) => c.id === grassColor);

  // Search across all categories; fall back to active-tab filter when empty
  const { query: q, setQuery: setQ, filtered: searchResults } = useFilter(
    DECORATION_KINDS,
    (k, s) =>
      DECORATIONS[k].label.toLowerCase().includes(s) ||
      DECORATIONS[k].category.includes(s) ||
      DECORATIONS[k].family.includes(s),
  );

  const filteredKinds = q.trim()
    ? searchResults
    : DECORATION_KINDS.filter((k) => DECORATIONS[k].category === activeTab);

  const searchGroups = useMemo(() => {
    if (!q.trim()) return null;
    const map = new Map<string, DecorationKind[]>();
    for (const k of searchResults) {
      const cat = DECORATIONS[k].category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(k);
    }
    return [...map.entries()] as [string, DecorationKind[]][];
  }, [q, searchResults]);

  const selectedKind = DECORATION_KINDS.includes(tool as DecorationKind)
    ? (tool as DecorationKind)
    : null;
  const selectedDef = selectedKind ? DECORATIONS[selectedKind] : null;

  if (!active) {
    return (
      <button
        type="button"
        className="build-entry-btn absolute inline-flex items-center gap-[6px] bg-bg-1 border border-line text-txt font-semibold cursor-pointer z-[6] right-[14px] bottom-[14px] px-[14px] py-2 rounded-[8px] shadow-[var(--shadow-2)] text-[13px] transition-[background,border-color] duration-100 hover:bg-bg-2 hover:border-line-2"
        onClick={onToggle}
        aria-label="Enter build mode"
      >
        <Icon name="hammer" size={13} />
        Build
      </button>
    );
  }

  return (
    <div className="build-panel absolute flex flex-col min-h-0 overflow-hidden z-[6] bg-bg-1 border border-line right-[14px] top-[14px] bottom-[14px] w-[300px] rounded-[var(--r-lg)] shadow-[var(--shadow-2)]">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="border-b border-line shrink-0 px-[16px] pt-[14px] pb-[10px]">
        <div className="flex items-center gap-[10px]">
          <div className="w-[28px] h-[28px] rounded-[7px] bg-acc-faint text-acc grid place-items-center shrink-0 bp-head-crest">
            <Icon name="hammer" size={14} />
          </div>
          <div>
            <div className="font-bold text-[14px] text-txt">Build</div>
            <div className="text-txt-3 text-[11px] mt-[1px] font-mono">painting decor · agent-office</div>
          </div>
        </div>
        <div className="flex gap-[3px] mt-[10px] bg-bg-2 border border-line p-[3px] rounded-[8px]">
          <button
            type="button"
            className={`flex-1 flex flex-col items-center relative cursor-pointer gap-[2px] text-txt-3 px-[4px] py-[6px] rounded-[5px] transition-[background,color] duration-100 hover:bg-bg-3 hover:text-txt${tool === "grass" ? " bg-acc text-white" : ""}`}
            onClick={() => onSelectTool("grass")}
            title="Paint terrain (B)"
          >
            <Icon name="pen" size={16} />
            <span className="uppercase tracking-[0.06em] font-mono text-[9px]">paint</span>
            <span className={`absolute top-[2px] right-[3px] font-mono text-[8.5px]${tool === "grass" ? " text-[rgba(255,255,255,0.5)]" : " text-txt-4"}`}>B</span>
          </button>
          <button
            type="button"
            className={`flex-1 flex flex-col items-center relative cursor-pointer gap-[2px] text-txt-3 px-[4px] py-[6px] rounded-[5px] transition-[background,color] duration-100 hover:bg-bg-3 hover:text-txt${tool === "erase" ? " bg-acc text-white" : ""}`}
            onClick={() => onSelectTool("erase")}
            title="Erase (E)"
          >
            <Icon name="trash" size={16} />
            <span className="uppercase tracking-[0.06em] font-mono text-[9px]">erase</span>
            <span className={`absolute top-[2px] right-[3px] font-mono text-[8.5px]${tool === "erase" ? " text-[rgba(255,255,255,0.5)]" : " text-txt-4"}`}>E</span>
          </button>
          <button
            type="button"
            className={`flex-1 flex flex-col items-center relative cursor-pointer gap-[2px] text-txt-3 px-[4px] py-[6px] rounded-[5px] transition-[background,color] duration-100 hover:bg-bg-3 hover:text-txt${tool === "fill" ? " bg-acc text-white" : ""}`}
            onClick={() => onSelectTool("fill")}
            title="Flood fill (F)"
          >
            <Icon name="paint-bucket" size={16} />
            <span className="uppercase tracking-[0.06em] font-mono text-[9px]">fill</span>
            <span className={`absolute top-[2px] right-[3px] font-mono text-[8.5px]${tool === "fill" ? " text-[rgba(255,255,255,0.5)]" : " text-txt-4"}`}>F</span>
          </button>
        </div>
      </div>

      {/* ── Island color ────────────────────────────────────────────── */}
      <div className="border-b border-line shrink-0 px-[14px] py-[10px]">
        <div className="flex items-center gap-[8px] uppercase text-txt-3 font-mono text-[10px] [letter-spacing:0.08em] mb-[6px]">
          Island color
          {grassColorDef && <span className="text-txt-2 text-[11px] normal-case tracking-normal">· {grassColorDef.label}</span>}
        </div>
        <div className="flex gap-[5px]">
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
      <div className="border-b border-line shrink-0 px-[14px] py-[8px]">
        <div className="bp-search flex items-center gap-[8px] bg-bg-2 border border-line text-txt-3 px-[10px] py-[6px] rounded-[7px] text-[12.5px]">
          <Icon name="search" size={13} />
          <input
            className="flex-1 bg-transparent border-0 outline-none text-txt text-[12px] placeholder:text-[var(--txt-3)]"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tiles…"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="flex items-center bg-transparent border-0 cursor-pointer text-txt-3 !p-0"
            >
              <Icon name="x" size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── Category tabs ───────────────────────────────────────────── */}
      {!q && (
        <div className="flex border-b border-line shrink-0 gap-0 px-[10px]" role="tablist" aria-label="Tile categories">
          {CATEGORY_TABS.map(({ id, label }) => {
            const count = DECORATION_KINDS.filter((k) => DECORATIONS[k].category === id).length;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                className={`bp-cat relative text-txt-3 font-medium cursor-pointer py-[7px] px-2 pb-[9px] text-[11.5px] transition-[color] duration-100 hover:text-txt ${activeTab === id ? "active text-txt font-semibold after:content-[''] after:absolute after:left-[6px] after:right-[6px] after:bottom-[-1px] after:h-[2px] after:bg-[var(--acc)] after:rounded-[2px_2px_0_0]" : ""}`}
                onClick={() => setActiveTab(id)}
              >
                {label}
                <span className="ml-1 text-txt-4 font-mono text-[9.5px]">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Tile grid ───────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto grid gap-[6px] p-[10px_12px_8px] [grid-template-columns:repeat(5,1fr)] [align-content:start] [scrollbar-width:thin] [scrollbar-color:var(--bg-3)_transparent]" role="tabpanel">
        {q.trim() ? (
          searchGroups && searchGroups.length > 0 ? (
            searchGroups.map(([cat, kinds]) => (
              <div key={cat} style={{ display: "contents" }}>
                <div className="flex items-center gap-2 uppercase text-txt-3 [grid-column:1/-1] my-[6px] -mb-[2px] font-mono text-[9.5px] tracking-[0.08em] capitalize">
                  {cat}<span className="flex-1 h-px bg-line" />
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
            <div className="text-center text-txt-3 [grid-column:1/-1] px-3 py-6 font-mono text-[11.5px]">No tiles match &ldquo;{q}&rdquo;</div>
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
      <div className="border-t border-line bg-bg-2 shrink-0 p-[10px_14px]">
        <div className="grid items-center gap-[10px] [grid-template-columns:38px_1fr_auto]">
          <div className="w-[38px] h-[38px] rounded-[7px] bg-bg-3 border border-line grid place-items-center text-[20px]">
            {selectedDef ? (
              <DecoSprite def={selectedDef} size={28} />
            ) : (
              <span className="text-txt-4 text-[18px]">·</span>
            )}
          </div>
          <div>
            <div className="font-semibold text-txt text-[12.5px]">{selectedDef?.label ?? "no selection"}</div>
            <div className="text-txt-3 mt-[2px] font-mono text-[10px]">
              {selectedDef ? (
                <>
                  <span>{selectedDef.category}</span>
                  <span className="text-txt-4 mx-1">·</span>
                  <span>{selectedDef.family}</span>
                  <span className="text-txt-4 mx-1">·</span>
                  <span>{selectedKind}</span>
                </>
              ) : (
                "pick a tile from the palette"
              )}
            </div>
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
  onSelect: (k: BuildTool | null) => void;
}) {
  const def = DECORATIONS[kind];
  return (
    <button
      type="button"
      className={`relative flex flex-col items-center justify-end gap-[3px] cursor-pointer overflow-hidden bg-bg-2 border border-line px-[3px] pt-[6px] pb-[5px] rounded-[7px] min-h-[56px] transition-[background,border-color] duration-100 hover:bg-bg-3 hover:border-line-2 ${selected ? "active bg-acc-faint" : ""}`}
      onClick={() => onSelect(kind)}
      title={`${def.label} · ${def.terrain}-only`}
      aria-pressed={selected}
    >
      <DecoSprite def={def} size={32} />
      <div className={`text-center overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[8px] leading-[1.2] max-w-full ${selected ? "text-acc" : "text-txt-3"}`}>{def.label}</div>
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
      className={`biome-swatch flex-1 relative cursor-pointer overflow-hidden h-[32px] rounded-[6px] transition-[transform,border-color] duration-100 hover:[transform:translateY(-1px)] hover:border-[var(--line-2)]${selected ? " active border-[var(--acc)] shadow-[0_0_0_2px_var(--acc-faint)] after:content-[''] after:absolute after:inset-[3px] after:rounded-[4px] after:border-[1.5px] after:border-[rgba(255,255,255,0.6)]" : " border-[1.5px] border-[var(--line)]"}`}
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
