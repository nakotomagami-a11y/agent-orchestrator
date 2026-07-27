"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UnitSprite } from "@/components/ui/unit-sprite";
import { UNIT_DEFS } from "@/components/ui/unit-sprite-registry";
import type { OfficeAgent } from "../hooks/use-office-agents";
import { DECORATIONS, decorationKey, familyOf, footprintCells, footprintCenterShift, type DecorationsMap, type DecoInstance } from "./decorations";
import type { BuildTool } from "./office-build-toolbar";
import {
  AGENT_DRAG_MIME,
  dragRefKey,
  useOfficeDragStore,
  type DragRef,
} from "../hooks/use-office-drag";
import {
  TILE,
  AGENT_SIZE,
  isToolValidAt,
  type AgentPositions,
  type VisibleRange,
} from "./office-map";

// Compute the CSS box position + size for a unit so its feet align with the
// same ground line used by the PixiJS canvas (TARGET_FEET_Y = (TILE+AGENT_SIZE)/2).
function unitBoxAt(kind: string, tx: number, ty: number) {
  const def = UNIT_DEFS[kind as keyof typeof UNIT_DEFS];
  const agentSize = def ? Math.round(AGENT_SIZE * (def.sizeMultiplier ?? 1)) : AGENT_SIZE;
  const left = tx * TILE + (TILE - agentSize) / 2;
  if (!def) return { left, top: ty * TILE + (TILE - AGENT_SIZE) / 2, size: AGENT_SIZE };
  const scale = agentSize / Math.max(def.bbox.w, def.bbox.h);
  const padY = (agentSize - def.bbox.h * scale) / 2;
  const groundNativeY = def.groundY ?? (def.bbox.y + def.bbox.h);
  const feetInBox = padY + (groundNativeY - def.bbox.y) * scale;
  // Must match TARGET_FEET_Y in office-pixi-canvas so the drag ghost lines up
  // with the real sprite: 10% of a tile above the cell's bottom edge.
  const TARGET_FEET_Y = TILE * 0.9;
  return { left, top: ty * TILE + TARGET_FEET_Y - feetInBox, size: agentSize };
}

// Screen box of a placed decoration instance — mirrors the pixi deco renderer
// (left/top incl. dx/dy offset) so select hit-targets line up with the sprites.
function decoBoxAt(inst: DecoInstance, x: number, y: number) {
  const def = DECORATIONS[inst.kind];
  const left = x * TILE + (TILE - def.frameW) / 2 + footprintCenterShift(inst.kind) * TILE + (inst.dx ?? 0);
  const top =
    (def.anchor === "center"
      ? y * TILE + (TILE - def.frameH) / 2
      : (y + 1) * TILE - def.frameH) + (inst.dy ?? 0);
  return { left, top, width: def.frameW, height: def.frameH };
}

// ─── Interaction overlay for the PixiJS renderer path ─────────────────────────
// Sits on top of the Pixi canvas at the same world transform. Handles build-mode
// grid cells (hover tint + click/drag-paint) and agent click targets (invisible
// buttons). All visual rendering is done by OfficePixiCanvas; this layer is
// purely for pointer interaction.

export type OfficeMapOverlayProps = {
  grid: boolean[][];
  decorations: DecorationsMap;
  agentPositions: AgentPositions;
  agentsById: Map<string, OfficeAgent>;
  buildMode: boolean;
  tool?: BuildTool | null;
  visibleRange: VisibleRange;
  onCellClick: (x: number, y: number, shiftKey?: boolean) => void;
  onAgentClick: (x: number, y: number, ref: DragRef) => void;
  onAgentDrop?: (x: number, y: number, ref: DragRef) => void;
  // Notifies the parent which agent tile is hovered ("x,y") so the PixiJS
  // renderer can glow the actual sprite. null = no hover.
  onAgentHoverChange?: (key: string | null) => void;
  // Free-hand "select" tool: currently-selected decoration instance + callbacks.
  selectedDeco?: { key: string; index: number } | null;
  onDecoSelect?: (key: string, index: number) => void;
  onDecoDeselect?: () => void;
  // "x,y:index" of the hovered decoration → pixi glows that sprite. null = none.
  onDecoHoverChange?: (key: string | null) => void;
  // Drag-to-reposition (select tool). zoom converts screen px → world px.
  zoom?: number;
  onDecoDragStart?: (key: string, index: number) => void;
  onDecoOffset?: (key: string, index: number, dx: number, dy: number) => void;
  // Agent editing with the select tool: select + pixel-nudge (no conversation).
  selectedAgentKey?: string | null;
  onAgentSelect?: (key: string) => void;
  onAgentDragStart?: (key: string) => void;
  onAgentOffset?: (key: string, dx: number, dy: number) => void;
};

// Memoized: during a camera pan the parent re-renders every frame, but this
// overlay renders hundreds of build-mode GridCells — skipping its reconciliation
// when props are unchanged is the single biggest pan-FPS win.
function OfficeMapOverlayImpl({
  grid,
  decorations,
  agentPositions,
  agentsById,
  buildMode,
  tool,
  visibleRange,
  onCellClick,
  onAgentClick,
  onAgentDrop,
  onAgentHoverChange,
  onDecoSelect,
  onDecoDeselect,
  onDecoHoverChange,
  zoom,
  onDecoDragStart,
  onDecoOffset,
  selectedAgentKey,
  onAgentSelect,
  onAgentDragStart,
  onAgentOffset,
}: OfficeMapOverlayProps) {
  const cols = grid[0]?.length ?? 0;
  const selectMode = tool === "select";

  // Drag-to-reposition state. Refs so the window listeners read live values
  // without re-subscribing. `pushed` gates the one-time undo snapshot to the
  // first real move, so a plain click doesn't pollute the undo stack.
  const decoDragRef = useRef<{ key: string; index: number; cx: number; cy: number; dx0: number; dy0: number; pushed: boolean } | null>(null);
  const decoCbRef = useRef({ zoom, onDecoDragStart, onDecoOffset });
  decoCbRef.current = { zoom, onDecoDragStart, onDecoOffset };
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = decoDragRef.current;
      if (!d) return;
      if (!d.pushed) {
        if (Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < 3) return;
        d.pushed = true;
        decoCbRef.current.onDecoDragStart?.(d.key, d.index);
      }
      const z = decoCbRef.current.zoom || 1;
      decoCbRef.current.onDecoOffset?.(d.key, d.index, d.dx0 + (e.clientX - d.cx) / z, d.dy0 + (e.clientY - d.cy) / z);
    };
    const onUp = () => { decoDragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, []);

  // Agent pixel-nudge drag (select tool) — same pattern as the deco drag above.
  const agentDragRef = useRef<{ key: string; cx: number; cy: number; dx0: number; dy0: number; pushed: boolean } | null>(null);
  const agentCbRef = useRef({ zoom, onAgentDragStart, onAgentOffset });
  agentCbRef.current = { zoom, onAgentDragStart, onAgentOffset };
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = agentDragRef.current;
      if (!d) return;
      if (!d.pushed) {
        if (Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < 3) return;
        d.pushed = true;
        agentCbRef.current.onAgentDragStart?.(d.key);
      }
      const z = agentCbRef.current.zoom || 1;
      agentCbRef.current.onAgentOffset?.(d.key, d.dx0 + (e.clientX - d.cx) / z, d.dy0 + (e.clientY - d.cy) / z);
    };
    const onUp = () => { agentDragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, []);

  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const dragging = useOfficeDragStore((s) => s.dragging);
  const setDragging = useOfficeDragStore((s) => s.setDragging);

  const stateRef = useRef({ grid, decorations, agentPositions, dragging, onCellClick, onAgentClick, onAgentDrop, setDragging, onAgentHoverChange });
  stateRef.current = { grid, decorations, agentPositions, dragging, onCellClick, onAgentClick, onAgentDrop, setDragging, onAgentHoverChange };

  const stableOnClick = useCallback((x: number, y: number, shiftKey: boolean) => {
    stateRef.current.onCellClick(x, y, shiftKey);
  }, []);

  const stableOnDragOver = useCallback((x: number, y: number, e: React.DragEvent<HTMLElement>, isValid: boolean) => {
    if (!stateRef.current.dragging) return;
    if (Array.from(e.dataTransfer.types).includes(AGENT_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = isValid ? "move" : "none";
      setHover({ x, y });
    }
  }, []);
  const stableOnDrop = useCallback((x: number, y: number, e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    // Clear drag state immediately — don't rely on onDragEnd firing after the
    // source button may have been unmounted by the agentPositions update.
    stateRef.current.setDragging(null);
    setHover(null);
    const { grid: g, decorations: d, agentPositions: ap, onAgentDrop: drop } = stateRef.current;
    const raw = e.dataTransfer.getData(AGENT_DRAG_MIME);
    if (!raw) return;
    try {
      const ref = JSON.parse(raw) as DragRef;
      const isGrass = g[y]?.[x] === true;
      if (!isGrass) {
        const stack = d[decorationKey(x, y)];
        if (!stack || !stack.some((k) => familyOf(k.kind) === "bridge")) return;
      }
      const existing = ap[decorationKey(x, y)];
      if (existing && dragRefKey(existing) !== dragRefKey(ref)) return;
      drop?.(x, y, ref);
    } catch { /* malformed drag payload */ }
  }, []);

  const validitySet = useMemo(() => {
    if (!buildMode && !dragging) return null;
    if (dragging) {
      const set = new Set<string>();
      for (let cy = visibleRange.yMin; cy <= visibleRange.yMax; cy++) {
        for (let cx = visibleRange.xMin; cx <= visibleRange.xMax; cx++) {
          const isGrass = grid[cy]?.[cx] === true;
          if (!isGrass) {
            const stack = decorations[decorationKey(cx, cy)];
            const hasBridge = !!stack && stack.some((k) => familyOf(k.kind) === "bridge");
            if (!hasBridge) continue;
          }
          const existing = agentPositions[decorationKey(cx, cy)];
          if (!existing || dragRefKey(existing) === dragRefKey(dragging)) set.add(decorationKey(cx, cy));
        }
      }
      return set;
    }
    if (!tool) return null;
    if (tool === "grass" || tool === "fill") return "inline-grass" as const;
    if (tool === "erase") return "inline-erase" as const;
    const set = new Set<string>();
    for (let cy = visibleRange.yMin; cy <= visibleRange.yMax; cy++) {
      for (let cx = visibleRange.xMin; cx <= visibleRange.xMax; cx++) {
        if (isToolValidAt(tool, cx, cy, grid, decorations)) set.add(decorationKey(cx, cy));
      }
    }
    return set;
  }, [buildMode, dragging, tool, grid, decorations, agentPositions, visibleRange]);

  const { yMin: yStart, yMax: yEnd, xMin: xStart, xMax: xEnd } = visibleRange;

  const cellValid = useCallback((x: number, y: number): boolean => {
    if (!validitySet) return false;
    if (validitySet === "inline-grass") return grid[y]?.[x] !== true;
    if (validitySet === "inline-erase") return grid[y]?.[x] === true || !!decorations[decorationKey(x, y)];
    return validitySet.has(decorationKey(x, y));
  }, [validitySet, grid, decorations]);

  // Tile under the pointer. The overlay lives inside the zoom-scaled wrapper, so
  // screen delta / zoom = world px. Single-surface pointer math means the build
  // grid is O(1) DOM regardless of map size (a per-tile DOM grid tanked FPS and
  // got capped-out on the big map, killing placement + the visible grid).
  const tileFromEvent = useCallback((e: { currentTarget: HTMLElement; clientX: number; clientY: number }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const z = zoom || 1;
    return {
      x: Math.floor((e.clientX - rect.left) / z / TILE),
      y: Math.floor((e.clientY - rect.top) / z / TILE),
    };
  }, [zoom]);

  const showGrid = (buildMode || dragging) && !selectMode;

  return (
    <div
      className="absolute left-0 top-0 pointer-events-none"
      style={{ width: cols * TILE, height: grid.length * TILE }}
    >
      {showGrid && (
        <>
          {/* Grid lines — one CSS-drawn element, scales to any map size */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                `repeating-linear-gradient(to right, rgba(255,255,255,0.11) 0 1px, transparent 1px ${TILE}px),` +
                `repeating-linear-gradient(to bottom, rgba(255,255,255,0.11) 0 1px, transparent 1px ${TILE}px)`,
            }}
          />
          {/* Interaction surface — a full-map button so the camera treats it as
              interactive (no pointer-capture → clicks register). Tile is derived
              from the pointer, so it's one element instead of thousands. */}
          <button
            type="button"
            aria-label="Build grid"
            className="absolute inset-0 p-0 m-0 bg-transparent border-0 pointer-events-auto cursor-crosshair"
            onPointerMove={(e) => {
              const t = tileFromEvent(e);
              setHover((h) => (h && h.x === t.x && h.y === t.y ? h : t));
            }}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => { if (e.detail === 0) return; const t = tileFromEvent(e); stableOnClick(t.x, t.y, e.shiftKey); }}
            onDragOver={(e) => { const t = tileFromEvent(e); stableOnDragOver(t.x, t.y, e, cellValid(t.x, t.y)); }}
            onDrop={(e) => { const t = tileFromEvent(e); stableOnDrop(t.x, t.y, e); }}
          />
          {/* Hover-tint — one cell for most tools, the full footprint region for
              multi-tile buildings. Colour reflects placement validity. */}
          {hover && (() => {
            const kind = tool && tool !== "grass" && tool !== "erase" && tool !== "fill" ? tool : null;
            const isBuilding = !!kind && DECORATIONS[kind].category === "buildings";
            const cells = isBuilding ? footprintCells(kind, hover.x, hover.y) : [[hover.x, hover.y] as [number, number]];
            const bg = cellValid(hover.x, hover.y) ? "rgba(34, 197, 94, 0.28)" : "rgba(239, 68, 68, 0.28)";
            return cells.map(([cx, cy]) => (
              <div
                key={`hover-${cx}-${cy}`}
                className="absolute pointer-events-none transition-[background] duration-[80ms]"
                style={{ left: cx * TILE, top: cy * TILE, width: TILE, height: TILE, background: bg }}
              />
            ));
          })()}
          {/* Ghost preview — translucent sprite at the hovered cell so you can
              see how a building/prop lands before placing. Only for single-frame
              decoration tools (skips grass/erase/fill/select + animated sheets). */}
          {hover && tool && tool !== "grass" && tool !== "erase" && tool !== "fill" && (() => {
            const def = DECORATIONS[tool];
            if (def.frames !== 1 || def.sheetW) return null;
            const { left, top, width, height } = decoBoxAt({ kind: tool }, hover.x, hover.y);
            const tint = cellValid(hover.x, hover.y) ? "#22c55e" : "#ef4444";
            return (
              <img
                src={def.src}
                alt=""
                aria-hidden
                draggable={false}
                className="absolute pointer-events-none opacity-50 [image-rendering:pixelated]"
                style={{ left, top, width, height, filter: `drop-shadow(0 0 3px ${tint})` }}
              />
            );
          })()}
        </>
      )}

      {/* Agent interaction targets: transparent draggable buttons over each agent tile */}
      {Object.entries(agentPositions).map(([key, ref]) => {
        const [xs, ys] = key.split(",");
        const x = Number(xs);
        const y = Number(ys);
        const agent = agentsById.get(ref.agentId);
        if (!agent) return null;
        if (x < xStart || x > xEnd || y < yStart || y > yEnd) return null;
        // Build + select tool: the agent becomes an editable object — click
        // selects it (no conversation), drag pixel-nudges it (like a decoration).
        if (buildMode && selectMode) {
          const isSel = selectedAgentKey === key;
          return (
            <button
              key={`agent-target-${key}`}
              type="button"
              className="absolute pointer-events-auto bg-transparent cursor-pointer"
              style={{ left: x * TILE, top: y * TILE, width: TILE, height: TILE, touchAction: "none" }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                agentDragRef.current = { key, cx: e.clientX, cy: e.clientY, dx0: ref.dx ?? 0, dy0: ref.dy ?? 0, pushed: false };
              }}
              onPointerEnter={() => onAgentHoverChange?.(key)}
              onPointerLeave={() => onAgentHoverChange?.(null)}
              onClick={(e) => { e.stopPropagation(); onAgentSelect?.(key); }}
              aria-label={`Select ${agent.name}`}
              aria-pressed={isSel}
            />
          );
        }
        return (
          <button
            key={`agent-target-${key}`}
            type="button"
            draggable
            className="absolute pointer-events-auto opacity-0 cursor-grab active:cursor-grabbing"
            style={{ left: x * TILE, top: y * TILE, width: TILE, height: TILE }}
            onClick={() => stateRef.current.onAgentClick(x, y, ref)}
            onMouseEnter={() => stateRef.current.onAgentHoverChange?.(key)}
            onMouseLeave={() => stateRef.current.onAgentHoverChange?.(null)}
            onDragStart={(e) => {
              e.dataTransfer.setData(AGENT_DRAG_MIME, JSON.stringify(ref));
              e.dataTransfer.setData("text/plain", ref.agentId);
              e.dataTransfer.effectAllowed = "move";
              stateRef.current.setDragging(ref);
            }}
            onDragEnd={() => stateRef.current.setDragging(null)}
            aria-label={`${agent.name} — click to open, drag to move`}
          />
        );
      })}

      {/* Hover glow is rendered by OfficePixiCanvas directly on the real sprite
          (see hoveredAgentKey) — no DOM duplicate here. */}

      {/* Drag ghost — semi-transparent sprite at the hovered drop cell while dragging */}
      {dragging && hover && (() => {
        const agent = agentsById.get(dragging.agentId);
        if (!agent) return null;
        const valid = validitySet instanceof Set ? validitySet.has(decorationKey(hover.x, hover.y)) : false;
        const tint = valid ? "#22c55e" : "#ef4444";
        const { left, top, size: agentSize } = unitBoxAt(agent.unitChoice.kind, hover.x, hover.y);
        return (
          <div
            aria-hidden
            className="absolute pointer-events-none opacity-60"
            style={{
              left,
              top,
              width: agentSize,
              height: agentSize,
              filter: `drop-shadow(0 0 4px ${tint}) drop-shadow(0 0 2px ${tint})`,
            }}
          >
            <UnitSprite unit={agent.unitChoice} size={agentSize} action="idle" animate={false} />
          </div>
        );
      })()}

      {/* Free-hand select tool: per-instance hit-targets with an orange
          hover/selected outline. Empty-ground clicks deselect via onCellClick,
          and agents stay clickable (no full-screen backdrop). */}
      {selectMode && (
        <>
          {Object.entries(decorations).flatMap(([key, stack]) => {
            const [xs, ys] = key.split(",");
            const x = Number(xs);
            const y = Number(ys);
            if (x < xStart || x > xEnd || y < yStart || y > yEnd) return [];
            return stack.map((inst, i) => {
              const { left, top, width, height } = decoBoxAt(inst, x, y);
              return (
                <button
                  key={`deco-target-${key}-${i}`}
                  type="button"
                  className="absolute pointer-events-auto cursor-pointer bg-transparent"
                  style={{ left, top, width, height, touchAction: "none" }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    decoDragRef.current = { key, index: i, cx: e.clientX, cy: e.clientY, dx0: inst.dx ?? 0, dy0: inst.dy ?? 0, pushed: false };
                  }}
                  onPointerEnter={() => onDecoHoverChange?.(`${key}:${i}`)}
                  onPointerLeave={() => onDecoHoverChange?.(null)}
                  onClick={(e) => { e.stopPropagation(); onDecoSelect?.(key, i); }}
                  onContextMenu={(e) => { e.preventDefault(); onDecoDeselect?.(); }}
                  aria-label={`Select ${DECORATIONS[inst.kind].label}`}
                />
              );
            });
          })}
        </>
      )}
    </div>
  );
}

export const OfficeMapOverlay = memo(OfficeMapOverlayImpl);
