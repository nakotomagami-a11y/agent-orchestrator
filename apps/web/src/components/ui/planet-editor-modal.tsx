"use client";

import { useEffect, useState, useCallback } from "react";
import type { PlanetConfig, PlanetType } from "@agent-office/shared/types";
import { PLANET_TYPE_DEFS, randomPlanetOfType } from "@/lib/planet-seed";
import { ModalShell } from "./modal-shell";
import { PlanetCanvas } from "./planet-canvas";
import { Icon } from "./icon";

interface PlanetEditorModalProps {
  open: boolean;
  projectId: string;
  current?: PlanetConfig;
  onSave: (config: PlanetConfig) => void;
  onClose: () => void;
}

const PLANET_TYPES: PlanetType[] = ["gas-giant", "rocky", "dry", "terran", "ice", "islands", "lava", "black-hole", "galaxy", "star", "asteroid"];
const FREEFORM_TYPES = new Set<PlanetType>(["asteroid", "galaxy", "star"]);

const DEFAULT_PIXELS = 50;
const PREVIEW_SIZES = [168, 96, 54] as const;
const PREVIEW_LABELS = ["Detail", "List", "Nav"] as const;

function randSeed() {
  return Math.floor(Math.random() * 999999999);
}

export function PlanetEditorModal({
  open,
  projectId,
  current,
  onSave,
  onClose,
}: PlanetEditorModalProps) {
  const [draft, setDraft] = useState<PlanetConfig>(
    current ?? { type: "gas-giant", seed: randSeed(), paletteIdx: 0, pixels: DEFAULT_PIXELS, dither: true },
  );

  useEffect(() => {
    if (open) {
      setDraft(current ?? { type: "gas-giant", seed: randSeed(), paletteIdx: 0, pixels: DEFAULT_PIXELS, dither: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setType = useCallback((type: PlanetType) => {
    const palettes = PLANET_TYPE_DEFS[type].palettes;
    setDraft((d) => ({
      ...d,
      type,
      paletteIdx: Math.min(d.paletteIdx, palettes.length - 1),
    }));
  }, []);

  const setPalette = useCallback((idx: number) => setDraft((d) => ({ ...d, paletteIdx: idx })), []);

  const randomize = useCallback(() => {
    const r = randomPlanetOfType(draft.type);
    setDraft((d) => ({ ...d, seed: r.seed, paletteIdx: r.paletteIdx }));
  }, [draft.type]);

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const typeDef = PLANET_TYPE_DEFS[draft.type];
  const pixels = draft.pixels ?? DEFAULT_PIXELS;
  const rotationDeg = Math.round(((draft.rotation ?? 0) * 180) / Math.PI);
  const dither = draft.dither ?? true;
  const isFreeform = FREEFORM_TYPES.has(draft.type);
  const freeformCls = isFreeform ? "" : "rounded-full overflow-hidden";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Planet"
      size="md"
      maxWidth={720}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center px-4 py-[7px] rounded-[8px] text-[13px] font-medium text-txt-2 bg-transparent border border-line hover:bg-bg-3 hover:text-txt transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-[6px] px-4 py-[7px] rounded-[8px] text-[13px] font-semibold text-white bg-acc hover:bg-[var(--acc-hover)] transition-colors border-none cursor-pointer"
          >
            <Icon name="check" size={13} />
            Save
          </button>
        </>
      }
    >
      <div className="flex gap-[18px]">
        {/* Left: size previews */}
        <div className="shrink-0 flex flex-col items-center gap-[14px] pt-[2px]">
          <div className="text-[9px] font-mono text-txt-4 uppercase tracking-wide">Preview</div>
          {PREVIEW_SIZES.map((sz, i) => (
            <div key={sz} className="flex flex-col items-center gap-[4px]">
              <div className="flex items-center justify-center" style={{ width: 168, height: sz }}>
                <PlanetCanvas
                  projectId={`${projectId}-editor`}
                  config={draft}
                  size={sz}
                  className={freeformCls}
                />
              </div>
              <span className="text-[8px] font-mono text-txt-4">{PREVIEW_LABELS[i]}</span>
            </div>
          ))}
        </div>

        {/* Right: all controls */}
        <div className="flex-1 min-w-0 flex flex-col gap-[12px]">
          {/* Type name */}
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[13px] font-bold text-txt leading-tight">{typeDef.label}</div>
              <div className="text-[11px] font-mono text-txt-3 mt-[1px]">
                {typeDef.palettes[draft.paletteIdx]?.name ?? "—"}
              </div>
            </div>
            <button
              type="button"
              onClick={randomize}
              className="inline-flex items-center gap-[5px] px-[8px] py-[4px] rounded-[6px] text-[11px] font-semibold text-txt-2 bg-bg-3 border border-line hover:bg-[rgba(255,255,255,0.06)] hover:text-txt transition-colors cursor-pointer shrink-0"
            >
              <Icon name="refresh" size={11} />
              Randomize
            </button>
          </div>

          {/* Planet type grid */}
          <div>
            <div className="text-[9px] font-mono text-txt-4 uppercase tracking-wide mb-[5px]">Type</div>
            <div className="grid grid-cols-4 gap-[4px]">
              {PLANET_TYPES.map((t) => {
                const def = PLANET_TYPE_DEFS[t];
                const selected = draft.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={[
                      "flex flex-col items-center gap-[4px] py-[6px] px-[2px] rounded-[8px] border transition-all duration-100 cursor-pointer",
                      selected
                        ? "bg-[rgba(255,120,60,0.10)] border-[rgba(255,120,60,0.45)]"
                        : "bg-bg-2 border-line hover:bg-bg-3 hover:border-line-2",
                    ].join(" ")}
                  >
                    <PlanetCanvas
                      projectId={`${projectId}-type-${t}`}
                      config={{ type: t, seed: draft.seed, paletteIdx: 0, pixels: draft.pixels, dither: draft.dither }}
                      size={28}
                      className={FREEFORM_TYPES.has(t) ? "" : "rounded-full overflow-hidden"}
                    />
                    <span className={[
                      "text-[8px] font-mono leading-[1.2] text-center w-full px-[1px]",
                      "overflow-hidden",
                      selected ? "text-acc" : "text-txt-3",
                    ].join(" ")}>
                      {def.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seed */}
          <div className="flex items-center gap-[6px]">
            <label className="text-[9px] font-mono text-txt-4 uppercase tracking-wide shrink-0 w-[40px]">Seed</label>
            <input
              type="number"
              value={draft.seed}
              min={1}
              max={999999999}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setDraft((d) => ({ ...d, seed: Math.max(1, v) }));
              }}
              className="flex-1 min-w-0 bg-bg-3 border border-line text-txt text-[11px] font-mono rounded-[6px] px-[8px] py-[3px] outline-none focus:border-line-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, seed: randSeed() }))}
              className="shrink-0 inline-flex items-center gap-[4px] px-[7px] py-[3px] rounded-[6px] text-[11px] font-semibold text-txt-2 bg-bg-3 border border-line hover:bg-[rgba(255,255,255,0.06)] hover:text-txt transition-colors cursor-pointer"
            >
              <Icon name="refresh" size={10} />
              Rand
            </button>
          </div>

          {/* Pixels */}
          <div className="flex items-center gap-[6px]">
            <label className="text-[9px] font-mono text-txt-4 uppercase tracking-wide shrink-0 w-[40px]">Pixels</label>
            <input
              type="range"
              min={10}
              max={300}
              step={5}
              value={pixels}
              onChange={(e) => setDraft((d) => ({ ...d, pixels: parseInt(e.target.value, 10) }))}
              className="flex-1 h-[3px] accent-[var(--acc)] cursor-pointer"
            />
            <span className="text-[11px] font-mono text-txt-3 w-[28px] text-right">{pixels}</span>
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-[6px]">
            <label className="text-[9px] font-mono text-txt-4 uppercase tracking-wide shrink-0 w-[40px]">Rotate</label>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={rotationDeg}
              onChange={(e) => {
                const deg = parseInt(e.target.value, 10);
                setDraft((d) => ({ ...d, rotation: (deg * Math.PI) / 180 }));
              }}
              className="flex-1 h-[3px] accent-[var(--acc)] cursor-pointer"
            />
            <span className="text-[11px] font-mono text-txt-3 w-[28px] text-right">{rotationDeg}°</span>
          </div>

          {/* Dither */}
          <div className="flex items-center gap-[6px]">
            <label className="text-[9px] font-mono text-txt-4 uppercase tracking-wide shrink-0 w-[40px]">Dither</label>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, dither: !(d.dither ?? true) }))}
              className={[
                "inline-flex items-center gap-[5px] px-[8px] py-[2px] rounded-[5px] text-[11px] font-semibold border transition-colors cursor-pointer",
                dither
                  ? "bg-[rgba(255,120,60,0.15)] border-[rgba(255,120,60,0.45)] text-acc"
                  : "bg-bg-3 border-line text-txt-3 hover:text-txt",
              ].join(" ")}
            >
              {dither ? "ON" : "OFF"}
            </button>
          </div>

          {/* Palette */}
          <div>
            <div className="text-[9px] font-mono text-txt-4 uppercase tracking-wide mb-[5px]">Palette</div>
            <div className="grid grid-cols-3 gap-[4px]">
              {typeDef.palettes.map((palette, idx) => {
                const selected = draft.paletteIdx === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPalette(idx)}
                    className={[
                      "flex items-center gap-[7px] px-[8px] py-[5px] rounded-[8px] border transition-all duration-100 cursor-pointer text-left",
                      selected
                        ? "bg-[rgba(255,120,60,0.10)] border-[rgba(255,120,60,0.45)]"
                        : "bg-bg-2 border-line hover:bg-bg-3 hover:border-line-2",
                    ].join(" ")}
                  >
                    <PlanetCanvas
                      projectId={`${projectId}-pal-${idx}`}
                      config={{ type: draft.type, seed: draft.seed, paletteIdx: idx, pixels: draft.pixels, dither: draft.dither }}
                      size={22}
                      className={`shrink-0 ${isFreeform ? "" : "rounded-full overflow-hidden"}`}
                    />
                    <span className={["text-[11px] font-semibold leading-tight truncate", selected ? "text-acc" : "text-txt-2"].join(" ")}>
                      {palette.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
