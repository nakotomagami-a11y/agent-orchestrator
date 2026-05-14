"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { OfficeMap, TILE, type AgentPositions } from "./office-map";
import { OfficeBuildToolbar, type BuildTool } from "./office-build-toolbar";
import {
  DECORATIONS,
  applyPlacement,
  decorationKey,
  hasBridgeCap,
  isPlacementValid,
  popDecoration,
  type DecorationKind,
  type DecorationsMap,
} from "./decorations";
import { useOfficeAgents } from "../hooks/use-office-agents";
import { useOfficeStore } from "../hooks/use-office-store";
import { dragRefKey, type DragRef } from "../hooks/use-office-drag";
import {
  DEFAULT_GRASS_COLOR,
  isGrassColor,
  type GrassColor,
} from "./grass-colors";

/**
 * Canvas for the new game-asset-based office view. Owns the editable
 * tile grid + decorations map + builder UI state.
 *
 * Both grid and decorations persist to the server via /api/ui-settings so the
 * user's build survives refreshes. Decoration placement is gated by
 * terrain: land decorations (bush, rock, tree) only on grass cells,
 * water decorations (water rock, duck) only on water cells. Mismatched
 * clicks are no-ops so the user can tell the wrong tool is selected.
 *
 * Erase: removes a decoration first if one is present, otherwise clears
 * the terrain. Two clicks fully empty a decorated grass cell.
 */

const GRID_COLS = 40;
const GRID_ROWS = 26;
const MAP_W = GRID_COLS * TILE;
const MAP_H = GRID_ROWS * TILE;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.15;

/** Default grid is empty — users build their own island. */
function makeSeedGrid(): boolean[][] {
  return Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => false),
  );
}

// Renamed/removed bridge kinds get rewritten on load. The four cap kinds
// (bridge_h_l/r, bridge_v_t/b) are no longer placeable — caps now auto-
// paint on adjacent land cells — so any persisted cap drops silently.
// The middle kinds got shorter names: bridge_h_m → bridge_h, _v_m → _v.
const KIND_MIGRATIONS: Record<string, DecorationKind | null> = {
  bridge_h_m: "bridge_h",
  bridge_v_m: "bridge_v",
  bridge_h_l: null,
  bridge_h_r: null,
  bridge_v_t: null,
  bridge_v_b: null,
};

function migrateKind(raw: string): DecorationKind | null {
  if (raw in KIND_MIGRATIONS) return KIND_MIGRATIONS[raw]!;
  return raw in DECORATIONS ? (raw as DecorationKind) : null;
}

export function OfficeScene() {
  const [grid, setGrid] = useState<boolean[][]>(() => makeSeedGrid());
  const [decorations, setDecorations] = useState<DecorationsMap>(() => ({}));
  const [agentPositions, setAgentPositions] = useState<AgentPositions>(() => ({}));
  const [buildMode, setBuildMode] = useState(false);
  const [tool, setTool] = useState<BuildTool>("grass");
  const [grassColor, setGrassColor] = useState<GrassColor>(() => DEFAULT_GRASS_COLOR);
  const [sceneLoaded, setSceneLoaded] = useState(false);
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);

  // Camera: pan (origin 0 0) + zoom
  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const panInitRef = useRef(false);
  const zoomRef = useRef(zoom);
  const panRef = useRef({ x: panX, y: panY });
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const isPainting = useRef(false);
  // Mirrors of mutable state that need to be readable inside stable callbacks
  const buildModeRef = useRef(buildMode);
  const toolRef = useRef<BuildTool>(tool);
  // Always points to the latest onCellClick; assigned after it's defined below
  const onCellClickRef = useRef<(x: number, y: number) => void>(() => undefined);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = { x: panX, y: panY }; }, [panX, panY]);
  useEffect(() => { buildModeRef.current = buildMode; }, [buildMode]);
  useEffect(() => { toolRef.current = tool; }, [tool]);

  // Load scene state from the server DB on mount
  useEffect(() => {
    fetch("/api/ui-settings")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        if (data["office-grid"]) {
          try {
            const parsed = JSON.parse(data["office-grid"]) as unknown;
            if (
              Array.isArray(parsed) &&
              parsed.length === GRID_ROWS &&
              parsed.every(
                (row): row is boolean[] =>
                  Array.isArray(row) &&
                  row.length === GRID_COLS &&
                  row.every((cell) => typeof cell === "boolean"),
              )
            ) {
              setGrid(parsed);
            }
          } catch { /* ignore */ }
        }
        if (data["office-decorations"]) {
          try {
            const parsed = JSON.parse(data["office-decorations"]) as unknown;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              const out: DecorationsMap = {};
              for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
                if (typeof value === "string") {
                  const migrated = migrateKind(value);
                  if (migrated) out[key] = [migrated];
                  continue;
                }
                if (Array.isArray(value)) {
                  const arr: DecorationKind[] = [];
                  for (const v of value) {
                    if (typeof v !== "string") continue;
                    const migrated = migrateKind(v);
                    if (migrated) arr.push(migrated);
                  }
                  if (arr.length > 0) out[key] = arr;
                }
              }
              setDecorations(out);
            }
          } catch { /* ignore */ }
        }
        if (data["office-agents"]) {
          try {
            const parsed = JSON.parse(data["office-agents"]) as unknown;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              const out: AgentPositions = {};
              for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
                if (
                  value && typeof value === "object" && !Array.isArray(value) &&
                  typeof (value as { agentId?: unknown }).agentId === "string"
                ) {
                  const v = value as { agentId: string; instanceId?: unknown };
                  out[key] = { agentId: v.agentId, instanceId: typeof v.instanceId === "string" ? v.instanceId : undefined };
                }
              }
              setAgentPositions(out);
            }
          } catch { /* ignore */ }
        }
        if (data["office-grass-color"]) {
          const gc = data["office-grass-color"];
          if (isGrassColor(gc)) setGrassColor(gc);
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => setSceneLoaded(true));
  }, []);

  // Centre the map on first paint
  useEffect(() => {
    if (panInitRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    panInitRef.current = true;
    const { width, height } = el.getBoundingClientRect();
    // Start at a comfortable zoom so the full map is visible in most viewports
    const fitZoom = Math.min(width / MAP_W, height / MAP_H, 1) * 0.85;
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fitZoom));
    setZoom(z);
    setPanX((width - MAP_W * z) / 2);
    setPanY((height - MAP_H * z) / 2);
  }, []);

  // Scroll-wheel → zoom to cursor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const z = zoomRef.current;
      const p = panRef.current;
      const factor = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * factor));
      const wx = (mx - p.x) / z;
      const wy = (my - p.y) / z;
      setZoom(newZoom);
      setPanX(mx - wx * newZoom);
      setPanY(my - wy * newZoom);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Grass paint drag: left button in build mode with grass tool, not on UI overlays
    const isOnOverlay = !!(e.target as Element).closest(
      '.build-panel, .canvas-tools, .build-actions-bar, .canvas-info, .build-entry-btn',
    );
    if (e.button === 0 && buildModeRef.current && (toolRef.current === "grass" || toolRef.current === "erase") && !isOnOverlay) {
      isPainting.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const wx = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
      const wy = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
      const tx = Math.floor(wx / TILE);
      const ty = Math.floor(wy / TILE);
      if (tx >= 0 && tx < GRID_COLS && ty >= 0 && ty < GRID_ROWS) {
        onCellClickRef.current(tx, ty);
      }
      return;
    }
    // Middle mouse always pans; left mouse only when not over interactive content
    const onInteractive = !!(e.target as Element).closest('button, a, input, [draggable="true"]');
    const isPan = e.button === 1 || (e.button === 0 && !onInteractive);
    if (!isPan) return;
    isDragging.current = true;
    hasDragged.current = false;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (e.button === 1) e.preventDefault();
    if (containerRef.current) containerRef.current.style.cursor = "grabbing";
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const wx = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
    const wy = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const inBounds = tx >= 0 && tx < GRID_COLS && ty >= 0 && ty < GRID_ROWS;
    setHoverTile(inBounds ? { x: tx, y: ty } : null);

    if (isPainting.current) {
      if (inBounds) onCellClickRef.current(tx, ty);
      return;
    }

    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (!hasDragged.current && Math.hypot(dx, dy) < 4) return;
    hasDragged.current = true;
    setPanX(dragStart.current.px + dx);
    setPanY(dragStart.current.py + dy);
  }, []);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
    isPainting.current = false;
    if (containerRef.current) containerRef.current.style.cursor = "";
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const z = zoomRef.current;
    const p = panRef.current;
    const el = containerRef.current;
    const cx = el ? el.clientWidth / 2 : MAP_W / 2;
    const cy = el ? el.clientHeight / 2 : MAP_H / 2;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * factor));
    const wx = (cx - p.x) / z;
    const wy = (cy - p.y) / z;
    setZoom(newZoom);
    setPanX(cx - wx * newZoom);
    setPanY(cy - wy * newZoom);
  }, []);

  const resetCamera = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const fitZoom = Math.min(width / MAP_W, height / MAP_H, 1) * 0.85;
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fitZoom));
    setZoom(z);
    setPanX((width - MAP_W * z) / 2);
    setPanY((height - MAP_H * z) / 2);
  }, []);

  const { agents } = useOfficeAgents();
  const agentsById = useMemo(() => {
    const m = new Map<string, (typeof agents)[number]>();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);

  useEffect(() => {
    if (!sceneLoaded) return;
    fetch("/api/ui-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "office-grid": JSON.stringify(grid) }),
    }).catch(() => { /* best-effort */ });
  }, [grid, sceneLoaded]);

  useEffect(() => {
    if (!sceneLoaded) return;
    fetch("/api/ui-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "office-decorations": JSON.stringify(decorations) }),
    }).catch(() => { /* best-effort */ });
  }, [decorations, sceneLoaded]);

  useEffect(() => {
    if (!sceneLoaded) return;
    fetch("/api/ui-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "office-agents": JSON.stringify(agentPositions) }),
    }).catch(() => { /* best-effort */ });
  }, [agentPositions, sceneLoaded]);

  useEffect(() => {
    if (!sceneLoaded) return;
    fetch("/api/ui-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "office-grass-color": grassColor }),
    }).catch(() => { /* best-effort */ });
  }, [grassColor, sceneLoaded]);

  const onCellClick = useCallback(
    (x: number, y: number) => {
      const key = decorationKey(x, y);
      const cellHasGrass = grid[y]?.[x] === true;

      if (tool === "grass") {
        if (cellHasGrass) return;
        setGrid((prev) => {
          const next = prev.map((row) => [...row]);
          next[y]![x] = true;
          return next;
        });
        setPendingChanges((n) => n + 1);
        // Defensive: drop any water-only decorations now stranded on land.
        setDecorations((prev) => {
          const existing = prev[key];
          if (!existing) return prev;
          const kept = existing.filter((k) => DECORATIONS[k].terrain === "land");
          if (kept.length === existing.length) return prev;
          const next = { ...prev };
          if (kept.length === 0) delete next[key];
          else next[key] = kept;
          return next;
        });
        return;
      }

      if (tool === "erase") {
        // Topmost first: agent → decoration (LIFO from stack) → terrain.
        // A heavily-decorated cell needs multiple clicks to fully clear.
        if (agentPositions[key]) {
          setAgentPositions((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          setPendingChanges((n) => n + 1);
          return;
        }
        const stack = decorations[key];
        if (stack && stack.length > 0) {
          const popped = popDecoration(stack);
          if (popped) {
            setDecorations((prev) => {
              const next = { ...prev };
              if (popped.stack.length === 0) delete next[key];
              else next[key] = popped.stack;
              return next;
            });
            setPendingChanges((n) => n + 1);
          }
          return;
        }
        if (cellHasGrass) {
          setGrid((prev) => {
            const next = prev.map((row) => [...row]);
            next[y]![x] = false;
            return next;
          });
          setPendingChanges((n) => n + 1);
        }
        return;
      }

      // Decoration tool: validate against current terrain, and refuse
      // to place on a tile that's reserved as a bridge ramp — those
      // cells render an auto-cap and can't host other decorations.
      if (!isPlacementValid(tool, cellHasGrass)) return;
      if (hasBridgeCap(x, y, grid, decorations)) return;
      setDecorations((prev) => {
        const stack = applyPlacement(prev[key], tool);
        return { ...prev, [key]: stack };
      });
      setPendingChanges((n) => n + 1);
    },
    [grid, decorations, agentPositions, tool],
  );

  // Keep ref in sync so pointer handlers can call the latest version
  useEffect(() => { onCellClickRef.current = onCellClick; }, [onCellClick]);

  // Arrow key panning + -/= zoom
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const step = TILE * zoomRef.current;
      if (e.key === "ArrowLeft")  { e.preventDefault(); setPanX((x) => x + step); }
      if (e.key === "ArrowRight") { e.preventDefault(); setPanX((x) => x - step); }
      if (e.key === "ArrowUp")    { e.preventDefault(); setPanY((y) => y + step); }
      if (e.key === "ArrowDown")  { e.preventDefault(); setPanY((y) => y - step); }
      if (e.key === "-") {
        e.preventDefault();
        const el = containerRef.current;
        const z = zoomRef.current;
        const p = panRef.current;
        const cx = el ? el.clientWidth / 2 : MAP_W / 2;
        const cy = el ? el.clientHeight / 2 : MAP_H / 2;
        const newZoom = Math.max(ZOOM_MIN, z * (1 - ZOOM_STEP));
        setZoom(newZoom);
        setPanX(cx - (cx - p.x) / z * newZoom);
        setPanY(cy - (cy - p.y) / z * newZoom);
      }
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        const el = containerRef.current;
        const z = zoomRef.current;
        const p = panRef.current;
        const cx = el ? el.clientWidth / 2 : MAP_W / 2;
        const cy = el ? el.clientHeight / 2 : MAP_H / 2;
        const newZoom = Math.min(ZOOM_MAX, z * (1 + ZOOM_STEP));
        setZoom(newZoom);
        setPanX(cx - (cx - p.x) / z * newZoom);
        setPanY(cy - (cy - p.y) / z * newZoom);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Drop handler — invoked by OfficeMap when an agent is dropped on a
  // grid cell that passes its terrain + overlap validation. Move
  // semantics: if the same agent is already on the map, its old cell
  // becomes empty.
  const onAgentDrop = useCallback((x: number, y: number, ref: DragRef) => {
    setAgentPositions((prev) => {
      const next: AgentPositions = {};
      const refK = dragRefKey(ref);
      for (const [k, v] of Object.entries(prev)) {
        if (dragRefKey(v) === refK) continue; // dropping same agent — clear old cell
        next[k] = v;
      }
      next[decorationKey(x, y)] = ref;
      return next;
    });
  }, []);

  // Routes a click on a placed agent. In build mode with the erase tool
  // armed, clear the agent at that cell. Otherwise open the inspector
  // for the clicked agent. The inspector uses the office store's
  // `select` action, which also flips the global selection so the
  // sidebar row highlights in sync.
  const selectAgent = useOfficeStore((s) => s.select);
  const onAgentClick = useCallback(
    (x: number, y: number, ref: DragRef) => {
      if (buildMode && tool === "erase") {
        setAgentPositions((prev) => {
          const next = { ...prev };
          delete next[decorationKey(x, y)];
          return next;
        });
        return;
      }
      selectAgent(ref.agentId, { instanceId: ref.instanceId ?? null });
    },
    [buildMode, tool, selectAgent],
  );

  return (
    <div
      ref={containerRef}
      className="office-scene"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundImage:
          "url('https://img.itch.zone/aW1nLzEwNDk2NzQ4LnBuZw==/original/eqMZWi.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        overflow: "hidden",
        cursor: "default",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Transform wrapper: pan + zoom applied here, OfficeMap anchored at 0,0 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: MAP_W,
          height: MAP_H,
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <OfficeMap
          grid={grid}
          decorations={decorations}
          agentPositions={agentPositions}
          agentsById={agentsById}
          grassColor={grassColor}
          editable={buildMode}
          tool={tool}
          onCellClick={onCellClick}
          onAgentDrop={onAgentDrop}
          onAgentClick={onAgentClick}
        />
      </div>

      {/* Canvas tools — top-left: zoom + grid + recenter */}
      <div className="canvas-tools">
        <button
          type="button"
          onClick={() => zoomBy(1 - ZOOM_STEP)}
          aria-label="Zoom out"
        >
          <Icon name="minus" size={11} />
        </button>
        <div
          className="zoom-readout"
          onClick={resetCamera}
          title="Reset camera"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") resetCamera(); }}
        >
          {Math.round(zoom * 100)}%
        </div>
        <button
          type="button"
          onClick={() => zoomBy(1 + ZOOM_STEP)}
          aria-label="Zoom in"
        >
          <Icon name="plus" size={11} />
        </button>
        <div className="sep" />
        <button
          type="button"
          title="Recenter"
          onClick={resetCamera}
        >
          <Icon name="crosshair" size={13} />
        </button>
      </div>

      {/* Canvas info — bottom-left: tile coords + map stats */}
      {(() => {
        const grassCount = grid.flat().filter(Boolean).length;
        const decoCount  = Object.values(decorations).reduce((s, stack) => s + (stack?.length ?? 0), 0);
        const placedCount = grassCount + decoCount;
        return (
          <div className="canvas-info">
            <div className="item">
              <div className="l">Tile</div>
              <div className="v">{hoverTile ? `${hoverTile.x}, ${hoverTile.y}` : "—"}</div>
            </div>
            <div className="item">
              <div className="l">Map</div>
              <div className="v">{GRID_COLS} × {GRID_ROWS}</div>
            </div>
            <div className="item">
              <div className="l">Placed</div>
              <div className="v">{placedCount} tiles</div>
            </div>
          </div>
        );
      })()}

      {/* Build actions bar — bottom-center, build mode only */}
      {buildMode && (
        <div className="build-actions-bar">
          <button
            type="button"
            className="stop"
            onClick={() => { setBuildMode(false); setPendingChanges(0); }}
          >
            <Icon name="x" size={13} /> Stop building
          </button>
          <div className="sep" />
          <button
            type="button"
            className="save"
            onClick={() => { setBuildMode(false); setPendingChanges(0); }}
          >
            {pendingChanges > 0 && <span className="led" />}
            <Icon name="check" size={13} />
            Save{pendingChanges > 0 ? ` · ${pendingChanges} changes` : ""}
          </button>
        </div>
      )}

      <OfficeBuildToolbar
        active={buildMode}
        tool={tool}
        grassColor={grassColor}
        onToggle={() => { setBuildMode((m) => !m); setPendingChanges(0); }}
        onSelectTool={setTool}
        onSelectGrassColor={setGrassColor}
      />
    </div>
  );
}
