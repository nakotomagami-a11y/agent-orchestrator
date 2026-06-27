"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { UnitSprite } from "@/components/ui/unit-sprite";
import { UNIT_DEFS } from "@/components/ui/unit-sprite.utils";
import type { OfficeAgent } from "../hooks/use-office-agents";
import { decorationKey, familyOf, type DecorationsMap } from "./decorations";
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
  const TARGET_FEET_Y = (TILE + AGENT_SIZE) / 2;
  return { left, top: ty * TILE + TARGET_FEET_Y - feetInBox, size: agentSize };
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
};

export function OfficeMapOverlay({
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
}: OfficeMapOverlayProps) {
  const cols = grid[0]?.length ?? 0;
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [agentHoverKey, setAgentHoverKey] = useState<string | null>(null);
  const dragging = useOfficeDragStore((s) => s.dragging);
  const setDragging = useOfficeDragStore((s) => s.setDragging);

  const stateRef = useRef({ grid, decorations, agentPositions, dragging, onCellClick, onAgentClick, onAgentDrop, setDragging });
  stateRef.current = { grid, decorations, agentPositions, dragging, onCellClick, onAgentClick, onAgentDrop, setDragging };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableOnEnter = useCallback((x: number, y: number) => setHover({ x, y }), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableOnLeave = useCallback((x: number, y: number) => {
    setHover((h) => (h?.x === x && h.y === y ? null : h));
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableOnClick = useCallback((x: number, y: number, shiftKey: boolean) => {
    stateRef.current.onCellClick(x, y, shiftKey);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableOnDragOver = useCallback((x: number, y: number, e: React.DragEvent<HTMLButtonElement>, isValid: boolean) => {
    if (!stateRef.current.dragging) return;
    if (Array.from(e.dataTransfer.types).includes(AGENT_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = isValid ? "move" : "none";
      setHover({ x, y });
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableOnDragLeave = useCallback((x: number, y: number) => {
    setHover((h) => (h?.x === x && h.y === y ? null : h));
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (!stack || !stack.some((k) => familyOf(k) === "bridge")) return;
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
            const hasBridge = !!stack && stack.some((k) => familyOf(k) === "bridge");
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
      {/* Build mode grid + drag-and-drop targets */}
      {(buildMode || dragging) && Array.from({ length: yEnd - yStart + 1 }).flatMap((_, i) => {
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
            onMouseEnter={() => setAgentHoverKey(key)}
            onMouseLeave={() => setAgentHoverKey((h) => h === key ? null : h)}
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

      {/* Hover glow — sprite-shaped golden drop-shadow on the hovered agent */}
      {agentHoverKey && !dragging && (() => {
        const [xs, ys] = agentHoverKey.split(",");
        const hx = Number(xs);
        const hy = Number(ys);
        const hRef = agentPositions[agentHoverKey];
        const hAgent = hRef ? agentsById.get(hRef.agentId) : null;
        if (!hAgent) return null;
        const { left, top, size: agentSize } = unitBoxAt(hAgent.unitChoice.kind, hx, hy);
        return (
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              left,
              top,
              width: agentSize,
              height: agentSize,
              transform: "scale(1.12)",
              filter: "drop-shadow(0 0 5px #fbbf24) drop-shadow(0 0 3px #fbbf24)",
            }}
          >
            <UnitSprite unit={hAgent.unitChoice} size={agentSize} action="idle" animate={false} />
          </div>
        );
      })()}

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
    </div>
  );
}
