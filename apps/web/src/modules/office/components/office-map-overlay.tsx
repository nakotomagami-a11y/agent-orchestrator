"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UnitSprite } from "@/components/ui/unit-sprite";
import { UNIT_DEFS } from "@/components/ui/unit-sprite-registry";
import type { OfficeAgent } from "../hooks/use-office-agents";
import { DECORATIONS, decorationKey, familyOf, type DecorationsMap, type DecoInstance } from "./decorations";
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
  GridCell,
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
  const left = x * TILE + (TILE - def.frameW) / 2 + (inst.dx ?? 0);
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
  // Drag-to-reposition (select tool). zoom converts screen px → world px.
  zoom?: number;
  onDecoDragStart?: (key: string, index: number) => void;
  onDecoOffset?: (key: string, index: number, dx: number, dy: number) => void;
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
  selectedDeco,
  onDecoSelect,
  onDecoDeselect,
  zoom,
  onDecoDragStart,
  onDecoOffset,
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
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const dragging = useOfficeDragStore((s) => s.dragging);
  const setDragging = useOfficeDragStore((s) => s.setDragging);

  const stateRef = useRef({ grid, decorations, agentPositions, dragging, onCellClick, onAgentClick, onAgentDrop, setDragging, onAgentHoverChange });
  stateRef.current = { grid, decorations, agentPositions, dragging, onCellClick, onAgentClick, onAgentDrop, setDragging, onAgentHoverChange };

   
  const stableOnEnter = useCallback((x: number, y: number) => setHover({ x, y }), []);
   
  const stableOnLeave = useCallback((x: number, y: number) => {
    setHover((h) => (h?.x === x && h.y === y ? null : h));
  }, []);
   
  const stableOnClick = useCallback((x: number, y: number, shiftKey: boolean) => {
    stateRef.current.onCellClick(x, y, shiftKey);
  }, []);
   
  const stableOnDragOver = useCallback((x: number, y: number, e: React.DragEvent<HTMLButtonElement>, isValid: boolean) => {
    if (!stateRef.current.dragging) return;
    if (Array.from(e.dataTransfer.types).includes(AGENT_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = isValid ? "move" : "none";
      setHover({ x, y });
    }
  }, []);
   
  const stableOnDragLeave = useCallback((x: number, y: number) => {
    setHover((h) => (h?.x === x && h.y === y ? null : h));
  }, []);
   
  const stableOnDrop = useCallback((x: number, y: number, e: React.DragEvent<HTMLButtonElement>) => {
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

  return (
    <div
      className="absolute left-0 top-0 pointer-events-none"
      style={{ width: cols * TILE, height: grid.length * TILE }}
    >
      {/* Build mode grid + drag-and-drop targets (hidden under the select tool) */}
      {(buildMode || dragging) && !selectMode && Array.from({ length: yEnd - yStart + 1 }).flatMap((_, i) => {
        const y = yStart + i;
        return Array.from({ length: xEnd - xStart + 1 }).map((_, j) => {
          const x = xStart + j;
          let valid: boolean;
          if (!validitySet) {
            valid = false;
          } else if (validitySet === "inline-grass") {
            valid = grid[y]?.[x] !== true;
          } else if (validitySet === "inline-erase") {
            valid = grid[y]?.[x] === true || !!decorations[decorationKey(x, y)];
          } else {
            valid = validitySet.has(decorationKey(x, y));
          }
          return (
            <GridCell
              key={`overlay-cell-${x}-${y}`}
              x={x}
              y={y}
              isHovered={hover?.x === x && hover.y === y}
              isValid={valid}
              isEditable
              onEnter={stableOnEnter}
              onLeave={stableOnLeave}
              onClick={stableOnClick}
              onDragOver={stableOnDragOver}
              onDragLeave={stableOnDragLeave}
              onDrop={stableOnDrop}
            />
          );
        });
      })}

      {/* Agent interaction targets: transparent draggable buttons over each agent tile */}
      {Object.entries(agentPositions).map(([key, ref]) => {
        const [xs, ys] = key.split(",");
        const x = Number(xs);
        const y = Number(ys);
        const agent = agentsById.get(ref.agentId);
        if (!agent) return null;
        if (x < xStart || x > xEnd || y < yStart || y > yEnd) return null;
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
              const isSelected = selectedDeco?.key === key && selectedDeco.index === i;
              return (
                <button
                  key={`deco-target-${key}-${i}`}
                  type="button"
                  className={`absolute pointer-events-auto cursor-pointer bg-transparent transition-[outline-color,background] duration-100 hover:bg-[rgba(233,84,32,0.12)] hover:outline hover:outline-2 hover:outline-[#e95420]${isSelected ? " outline outline-2 outline-[#e95420] bg-[rgba(233,84,32,0.10)]" : ""}`}
                  style={{ left, top, width, height, touchAction: "none" }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    decoDragRef.current = { key, index: i, cx: e.clientX, cy: e.clientY, dx0: inst.dx ?? 0, dy0: inst.dy ?? 0, pushed: false };
                  }}
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
