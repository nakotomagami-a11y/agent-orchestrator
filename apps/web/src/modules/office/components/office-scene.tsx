"use client";

import { useCallback, useEffect, useMemo, useRef, startTransition, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { OfficeMap, OfficeMapOverlay, TILE, type AgentPositions, type VisibleRange } from "./office-map";
import { OfficePixiCanvas } from "./office-pixi-canvas";
import { OfficeBuildToolbar, type BuildTool } from "./office-build-toolbar";
import {
  DECORATIONS,
  applyPlacement,
  decorationKey,
  familyOf,
  hasBridgeCap,
  isPlacementValid,
  popDecoration,
  type DecorationKind,
  type DecorationsMap,
} from "./decorations";
import { useOfficeAgents } from "../hooks/use-office-agents";
import { useOfficeStore } from "../hooks/use-office-store";
import { dragRefKey, type DragRef } from "../hooks/use-office-drag";
import { useProject } from "@/modules/projects/hooks/use-projects";
import { useSettings } from "@/modules/settings/hooks/use-settings";
import { useProjectSpend } from "@/modules/projects/hooks/use-project-spend";
import {
  DEFAULT_GRASS_COLOR,
  isGrassColor,
  type GrassColor,
} from "./grass-colors";
import {
  useOfficeCamera,
  GRID_COLS,
  GRID_ROWS,
  ZOOM_STEP,
} from "../hooks/use-office-camera";
import { useOfficePainting } from "../hooks/use-office-painting";
import type { AgentInstance } from "@agent-office/shared/types";
import type { OfficeView } from "../hooks/use-office-store";

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

// Renamed/removed bridge kinds get rewritten on load. The four cap kinds
// (bridge_h_l/r, bridge_v_t/b) are no longer placeable - caps now auto-
// paint on adjacent land cells - so any persisted cap drops silently.
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
  if (raw in KIND_MIGRATIONS) return KIND_MIGRATIONS[raw] ?? null;
  return raw in DECORATIONS ? (raw as DecorationKind) : null;
}

function parseGrid(raw: string): boolean[][] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
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
      return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

function parseDecorations(raw: string): DecorationsMap | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
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
    return out;
  } catch { /* ignore */ }
  return null;
}

function parseAgentPositions(raw: string): AgentPositions | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
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
    return out;
  } catch { /* ignore */ }
  return null;
}

/** Default grid is empty - users build their own island. */
function makeSeedGrid(): boolean[][] {
  return Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => false),
  );
}

/**
 * BFS flood-fill: turns connected water cells starting at (startX, startY)
 * into grass. Returns the new grid and the number of cells filled.
 */
function floodFill(
  grid: boolean[][],
  startX: number,
  startY: number,
): [boolean[][], number] {
  if (grid[startY]?.[startX] === true) return [grid, 0]; // already grass
  const next = grid.map((row) => [...row]);
  // Use a flat Uint8Array bitmap instead of a string-keyed Set — no string
  // allocations per cell, O(1) lookup, and no O(n) shift on dequeue.
  const visited = new Uint8Array(GRID_COLS * GRID_ROWS);
  let head = 0;
  const queue: [number, number][] = [[startX, startY]];
  let count = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++]!;
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) continue;
    const idx = y * GRID_COLS + x;
    if (visited[idx]) continue;
    visited[idx] = 1;
    if (next[y]![x]) continue;
    next[y]![x] = true;
    count++;
    queue.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
  return [next, count];
}

// Stable empty-array and empty-object fallbacks to avoid recreating them
// on every render (which would defeat React.memo equality checks).
const EMPTY_ROSTER: AgentInstance[] = [];
const EMPTY_SPEND: Record<string, number> = {};

type Snapshot = {
  grid: boolean[][];
  decorations: DecorationsMap;
  agentPositions: AgentPositions;
};

export function OfficeScene({
  projectId,
  view,
  setView,
}: {
  projectId: string | null;
  view: OfficeView;
  setView: (v: OfficeView) => void;
}) {
  const [grid, setGrid] = useState<boolean[][]>(() => makeSeedGrid());
  const [decorations, setDecorations] = useState<DecorationsMap>(() => ({}));
  const [agentPositions, setAgentPositions] = useState<AgentPositions>(() => ({}));
  const [buildMode, setBuildMode] = useState(false);
  const [tool, setTool] = useState<BuildTool | null>(null);
  const [grassColor, setGrassColor] = useState<GrassColor>(() => DEFAULT_GRASS_COLOR);
  const [sceneLoaded, setSceneLoaded] = useState(false);
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [agentSearch, setAgentSearch] = useState("");
  const [useCustomMap, setUseCustomMap] = useState(false);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);
  // First corner of a shift-click rectangle selection (paint/erase tools only)
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);

  // Undo/redo session history (not server-synced, session-only)
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  // Refs always reflect latest state so callbacks don't need them in deps.
  // Assigned during render (safe - refs are mutable, no re-render triggered).
  const currentStateRef = useRef<Snapshot>({ grid, decorations, agentPositions });
  currentStateRef.current = { grid, decorations, agentPositions };
  const rectStartRef = useRef<{ x: number; y: number } | null>(null);
  rectStartRef.current = rectStart;

  const {
    zoom, panX, panY,
    containerRef,
    zoomRef,
    panRef,
    onPointerDown: camPointerDown,
    onPointerMove: camPointerMove,
    onPointerUp: camPointerUp,
    zoomBy,
    resetCamera,
  } = useOfficeCamera();

  const {
    buildModeRef,
    toolRef,
    onCellClickRef,
    onPointerDown: paintPointerDown,
    onPointerMove: paintPointerMove,
    onPointerUp: paintPointerUp,
  } = useOfficePainting({ panRef, zoomRef });

  // Sync painting refs with React state
  useEffect(() => { buildModeRef.current = buildMode; }, [buildMode, buildModeRef]);
  useEffect(() => { toolRef.current = tool; }, [tool, toolRef]);

  // HUD counters — memoized so grid.flat() doesn't run on every pointer-move render
  const grassCount = useMemo(() => grid.flat().filter(Boolean).length, [grid]);
  const decoCount = useMemo(
    () => Object.values(decorations).reduce((s, stack) => s + (stack?.length ?? 0), 0),
    [decorations],
  );

  // Track container size for viewport culling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]!.contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  // Visible cell range — only cells within this bounding box are rendered.
  // Falls back to full grid until the ResizeObserver fires. The ref gives
  // useMemo a stable object to return when computed tile indices are unchanged,
  // so OfficeMap (memo'd) skips re-rendering on every pan pointer event.
  const prevVisibleRangeRef = useRef<VisibleRange>({ xMin: 0, xMax: GRID_COLS - 1, yMin: 0, yMax: GRID_ROWS - 1 });
  const visibleCellRange = useMemo<VisibleRange>(() => {
    if (!containerSize) return prevVisibleRangeRef.current;
    const OVERSCAN = 2;
    const xMin = Math.max(0, Math.floor(-panX / zoom / TILE) - OVERSCAN);
    const xMax = Math.min(GRID_COLS - 1, Math.ceil((-panX + containerSize.w) / zoom / TILE) + OVERSCAN);
    const yMin = Math.max(0, Math.floor(-panY / zoom / TILE) - OVERSCAN);
    const yMax = Math.min(GRID_ROWS - 1, Math.ceil((-panY + containerSize.h) / zoom / TILE) + OVERSCAN);
    const prev = prevVisibleRangeRef.current;
    if (prev.xMin === xMin && prev.xMax === xMax && prev.yMin === yMin && prev.yMax === yMax) return prev;
    const next: VisibleRange = { xMin, xMax, yMin, yMax };
    prevVisibleRangeRef.current = next;
    return next;
  }, [panX, panY, zoom, containerSize]);

  // Load scene state from the server DB on mount.
  // Agent positions are always per-project when a project is active.
  // Map layout (grid/decorations/grass) is shared by default; a per-project
  // copy is used when office-map-custom:{projectId} === "true".
  useEffect(() => {
    fetch("/api/ui-settings")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        const customMap = projectId
          ? data[`office-map-custom:${projectId}`] === "true"
          : false;
        if (customMap) setUseCustomMap(true);

        const gridKey  = customMap && projectId ? `office-grid:${projectId}`         : "office-grid";
        const decoKey  = customMap && projectId ? `office-decorations:${projectId}`  : "office-decorations";
        const grassKey = customMap && projectId ? `office-grass-color:${projectId}`  : "office-grass-color";
        const agentKey = projectId              ? `office-agents:${projectId}`        : "office-agents";

        if (data[gridKey]) {
          const g = parseGrid(data[gridKey]);
          if (g) setGrid(g);
        }
        if (data[decoKey]) {
          const d = parseDecorations(data[decoKey]);
          if (d) setDecorations(d);
        }
        if (data[agentKey]) {
          const ap = parseAgentPositions(data[agentKey]);
          if (ap) setAgentPositions(ap);
        }
        if (data[grassKey]) {
          const gc = data[grassKey];
          if (isGrassColor(gc)) setGrassColor(gc);
        }
      })
      .catch(() => { /* ignore */ })
      // projectId is stable for this instance - the key prop forces a remount on change
      // eslint-disable-next-line react-hooks/exhaustive-deps
      .finally(() => setSceneLoaded(true));
  }, []);

  const { agents } = useOfficeAgents();
  const agentsById = useMemo(() => {
    const m = new Map<string, (typeof agents)[number]>();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);

  // Multi-instance data: roster + feature flag + spend
  const settingsQ = useSettings();
  const isMultiInstance = settingsQ.data?.features?.multiInstance === true;
  // Pixi renderer is on by default; explicitly set features.newOfficeRenderer=false to revert to DOM path
  const usePixiRenderer = settingsQ.data?.features?.newOfficeRenderer !== false;
  const projectQ = useProject(projectId);
  const rosterInstances = projectQ.data?.meta.roster ?? EMPTY_ROSTER;
  const spendQ = useProjectSpend(isMultiInstance ? projectId : null);
  const spendByInstance = spendQ.data?.byInstance ?? EMPTY_SPEND;

  // Prune agentPositions entries whose agent no longer exists.
  useEffect(() => {
    if (!sceneLoaded) return;
    setAgentPositions((prev) => {
      const stale = Object.keys(prev).filter((k) => !agentsById.has(prev[k]!.agentId));
      if (stale.length === 0) return prev;
      const next = { ...prev };
      for (const k of stale) delete next[k];
      return next;
    });
  }, [agentsById, sceneLoaded]);

  // Auto-save effects — debounced 400ms so a 100-cell paint drag fires
  // one PATCH after the brush lifts, not 100 individual requests.
  useEffect(() => {
    if (!sceneLoaded) return;
    const key = useCustomMap && projectId ? `office-grid:${projectId}` : "office-grid";
    const timer = setTimeout(() => {
      fetch("/api/ui-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: JSON.stringify(grid) }),
      }).catch(() => { /* best-effort */ });
    }, 400);
    return () => clearTimeout(timer);
  }, [grid, sceneLoaded, useCustomMap, projectId]);

  useEffect(() => {
    if (!sceneLoaded) return;
    const key = useCustomMap && projectId ? `office-decorations:${projectId}` : "office-decorations";
    const timer = setTimeout(() => {
      fetch("/api/ui-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: JSON.stringify(decorations) }),
      }).catch(() => { /* best-effort */ });
    }, 400);
    return () => clearTimeout(timer);
  }, [decorations, sceneLoaded, useCustomMap, projectId]);

  useEffect(() => {
    if (!sceneLoaded) return;
    const key = projectId ? `office-agents:${projectId}` : "office-agents";
    const timer = setTimeout(() => {
      fetch("/api/ui-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: JSON.stringify(agentPositions) }),
      }).catch(() => { /* best-effort */ });
    }, 400);
    return () => clearTimeout(timer);
  }, [agentPositions, sceneLoaded, projectId]);

  useEffect(() => {
    if (!sceneLoaded) return;
    const key = useCustomMap && projectId ? `office-grass-color:${projectId}` : "office-grass-color";
    const timer = setTimeout(() => {
      fetch("/api/ui-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: grassColor }),
      }).catch(() => { /* best-effort */ });
    }, 400);
    return () => clearTimeout(timer);
  }, [grassColor, sceneLoaded, useCustomMap, projectId]);

  // Clear rectStart when the user switches tools
  useEffect(() => { setRectStart(null); }, [tool]);

  const onCellClick = useCallback(
    (x: number, y: number, shiftKey = false) => {
      // Read all state from refs — this callback never closes over state,
      // so it stays stable ([] deps) and never breaks OfficeMap's memo.
      const { grid, decorations, agentPositions } = currentStateRef.current;
      const rectStart = rectStartRef.current;
      const tool = toolRef.current;

      const key = decorationKey(x, y);
      const cellHasGrass = grid[y]?.[x] === true;

      if (!tool) return;

      // Shift-click rectangle fill for paint/erase terrain tools
      if (shiftKey && rectStart && (tool === "grass" || tool === "erase")) {
        undoStack.current = [...undoStack.current.slice(-49), { grid, decorations, agentPositions }];
        redoStack.current = [];
        const xMin = Math.min(rectStart.x, x);
        const xMax = Math.max(rectStart.x, x);
        const yMin = Math.min(rectStart.y, y);
        const yMax = Math.max(rectStart.y, y);
        if (tool === "grass") {
          startTransition(() => {
            setGrid((prev) => {
              const next = [...prev];
              for (let cy = yMin; cy <= yMax; cy++) {
                next[cy] = [...prev[cy]!];
                for (let cx = xMin; cx <= xMax; cx++) next[cy]![cx] = true;
              }
              return next;
            });
          });
        } else {
          startTransition(() => {
            setGrid((prev) => {
              const next = [...prev];
              for (let cy = yMin; cy <= yMax; cy++) {
                next[cy] = [...prev[cy]!];
                for (let cx = xMin; cx <= xMax; cx++) next[cy]![cx] = false;
              }
              return next;
            });
            setDecorations((prev) => {
              const next = { ...prev };
              for (let cy = yMin; cy <= yMax; cy++)
                for (let cx = xMin; cx <= xMax; cx++)
                  delete next[decorationKey(cx, cy)];
              return next;
            });
            setAgentPositions((prev) => {
              const next = { ...prev };
              for (let cy = yMin; cy <= yMax; cy++)
                for (let cx = xMin; cx <= xMax; cx++)
                  delete next[decorationKey(cx, cy)];
              return next;
            });
          });
        }
        setPendingChanges((n) => n + (xMax - xMin + 1) * (yMax - yMin + 1));
        setRectStart(null);
        return;
      }

      if (tool === "grass") {
        if (cellHasGrass) return;
        undoStack.current = [...undoStack.current.slice(-49), { grid, decorations, agentPositions }];
        redoStack.current = [];
        setRectStart({ x, y });
        setPendingChanges((n) => n + 1);
        startTransition(() => {
          // Only copy the one row that changes — O(GRID_COLS) not O(GRID_ROWS*GRID_COLS)
          setGrid((prev) => {
            if (prev[y]?.[x] === true) return prev;
            const next = [...prev];
            next[y] = [...prev[y]!];
            next[y]![x] = true;
            return next;
          });
          // Drop any water-only decorations now stranded on land
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
        });
        return;
      }

      if (tool === "fill") {
        if (cellHasGrass) return;
        const [newGrid, count] = floodFill(grid, x, y);
        if (count === 0) return;
        undoStack.current = [...undoStack.current.slice(-49), { grid, decorations, agentPositions }];
        redoStack.current = [];
        setPendingChanges((n) => n + count);
        startTransition(() => {
          setGrid(newGrid);
        });
        return;
      }

      if (tool === "erase") {
        // Topmost first: agent → decoration (LIFO from stack) → terrain
        if (agentPositions[key]) {
          undoStack.current = [...undoStack.current.slice(-49), { grid, decorations, agentPositions }];
          redoStack.current = [];
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
            undoStack.current = [...undoStack.current.slice(-49), { grid, decorations, agentPositions }];
            redoStack.current = [];
            setDecorations((prev) => {
              const next = { ...prev };
              if (popped.stack.length === 0) delete next[key];
              else next[key] = popped.stack;
              return next;
            });
            // If a bridge was removed from a water cell, evict any agent.
            const isWater = grid[y]?.[x] !== true;
            const bridgeGone = isWater && !popped.stack.some((k) => familyOf(k) === "bridge");
            if (bridgeGone && agentPositions[key]) {
              setAgentPositions((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
            }
            setPendingChanges((n) => n + 1);
          }
          return;
        }
        if (cellHasGrass) {
          undoStack.current = [...undoStack.current.slice(-49), { grid, decorations, agentPositions }];
          redoStack.current = [];
          setRectStart({ x, y });
          setPendingChanges((n) => n + 1);
          startTransition(() => {
            // Only copy the one row that changes
            setGrid((prev) => {
              if (prev[y]?.[x] !== true) return prev;
              const next = [...prev];
              next[y] = [...prev[y]!];
              next[y]![x] = false;
              return next;
            });
          });
        }
        return;
      }

      // Decoration tool: validate against terrain, refuse on bridge ramp tiles
      if (!isPlacementValid(tool, cellHasGrass)) return;
      if (hasBridgeCap(x, y, grid, decorations)) return;
      undoStack.current = [...undoStack.current.slice(-49), { grid, decorations, agentPositions }];
      redoStack.current = [];
      setDecorations((prev) => {
        const stack = applyPlacement(prev[key], tool);
        return { ...prev, [key]: stack };
      });
      setPendingChanges((n) => n + 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // stable forever — all state is read through refs
  );

  // Keep ref in sync so pointer handlers can call the latest version
  useEffect(() => { onCellClickRef.current = onCellClick; }, [onCellClick, onCellClickRef]);

  // rAF throttle state for the hover-tile HUD update
  const pointerRafRef = useRef<number | null>(null);
  const lastHoverTileRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (paintPointerDown(e)) return;
      camPointerDown(e);
    },
    [paintPointerDown, camPointerDown],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!paintPointerMove(e)) camPointerMove(e);

      // Defer the HUD tile-coordinate update to rAF to avoid a
      // getBoundingClientRect() forced-layout on every pointer event.
      if (pointerRafRef.current !== null) return;
      const clientX = e.clientX;
      const clientY = e.clientY;
      const el = e.currentTarget as HTMLElement;
      pointerRafRef.current = requestAnimationFrame(() => {
        pointerRafRef.current = null;
        const rect = el.getBoundingClientRect();
        const wx = (clientX - rect.left - panRef.current.x) / zoomRef.current;
        const wy = (clientY - rect.top - panRef.current.y) / zoomRef.current;
        const tx = Math.floor(wx / TILE);
        const ty = Math.floor(wy / TILE);
        const inBounds = tx >= 0 && tx < GRID_COLS && ty >= 0 && ty < GRID_ROWS;
        const newTile = inBounds ? { x: tx, y: ty } : null;
        const last = lastHoverTileRef.current;
        if (newTile?.x === last?.x && newTile?.y === last?.y) return;
        lastHoverTileRef.current = newTile;
        setHoverTile(newTile);
      });
    },
    [paintPointerMove, camPointerMove, panRef, zoomRef],
  );

  const onPointerUp = useCallback(() => {
    paintPointerUp();
    camPointerUp();
    if (pointerRafRef.current !== null) {
      cancelAnimationFrame(pointerRafRef.current);
      pointerRafRef.current = null;
    }
  }, [paintPointerUp, camPointerUp]);

  // Drop handler - invoked by OfficeMap when an agent is dropped on a
  // grid cell that passes its terrain + overlap validation. Move
  // semantics: if the same agent is already on the map, its old cell
  // becomes empty.
  const onBuildToggle = useCallback(() => {
    setBuildMode((m) => { if (!m) setAgentSearch(""); return !m; });
    setPendingChanges(0);
  }, []);

  const onAgentDrop = useCallback((x: number, y: number, ref: DragRef) => {
    setAgentPositions((prev) => {
      const next: AgentPositions = {};
      const refK = dragRefKey(ref);
      for (const [k, v] of Object.entries(prev)) {
        if (dragRefKey(v) === refK) continue;
        next[k] = v;
      }
      next[decorationKey(x, y)] = ref;
      return next;
    });
  }, []);

  // Fork the current global map into project-specific keys so the user can
  // independently customise the layout for this project.
  const enableCustomMap = useCallback(() => {
    if (!projectId) return;
    setUseCustomMap(true);
    // Persist the flag; the save effects will fork current state to project keys.
    fetch("/api/ui-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [`office-map-custom:${projectId}`]: "true" }),
    }).catch(() => {});
  }, [projectId]);

  // Revert back to the shared global map layout for this project.
  // Chain the PATCH before the GET so we never read stale custom-flag state.
  const disableCustomMap = useCallback(() => {
    if (!projectId) return;
    setSceneLoaded(false); // block saves while we reload global state
    setUseCustomMap(false);
    fetch("/api/ui-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [`office-map-custom:${projectId}`]: "false" }),
    })
      .catch(() => {})
      .finally(() => {
        fetch("/api/ui-settings")
          .then((r) => r.json())
          .then((data: Record<string, string>) => {
            if (data["office-grid"]) {
              const g = parseGrid(data["office-grid"]);
              setGrid(g ?? makeSeedGrid());
            } else {
              setGrid(makeSeedGrid());
            }
            if (data["office-decorations"]) {
              const d = parseDecorations(data["office-decorations"]);
              setDecorations(d ?? {});
            } else {
              setDecorations({});
            }
            // Also reload agent positions from the global (non-project-specific) key
            const agentKey = `office-agents:${projectId}`;
            if (data[agentKey]) {
              const ap = parseAgentPositions(data[agentKey]);
              setAgentPositions(ap ?? {});
            } else {
              setAgentPositions({});
            }
            if (data["office-grass-color"]) {
              const gc = data["office-grass-color"];
              if (isGrassColor(gc)) setGrassColor(gc);
              else setGrassColor(DEFAULT_GRASS_COLOR);
            } else {
              setGrassColor(DEFAULT_GRASS_COLOR);
            }
          })
          .catch(() => {})
          .finally(() => setSceneLoaded(true));
      });
  }, [projectId]);

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

  // Keyboard shortcuts for build mode: tool selection (B/E/F), Escape to exit,
  // and Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z for undo/redo.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const isCmd = e.metaKey || e.ctrlKey;

      if (buildMode && isCmd && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const snapshot = undoStack.current.pop();
        if (!snapshot) return;
        redoStack.current.push(currentStateRef.current);
        setGrid(snapshot.grid);
        setDecorations(snapshot.decorations);
        setAgentPositions(snapshot.agentPositions);
        setRectStart(null);
        setPendingChanges((n) => n + 1);
        return;
      }
      if (buildMode && isCmd && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
        e.preventDefault();
        const snapshot = redoStack.current.pop();
        if (!snapshot) return;
        undoStack.current.push(currentStateRef.current);
        setGrid(snapshot.grid);
        setDecorations(snapshot.decorations);
        setAgentPositions(snapshot.agentPositions);
        setRectStart(null);
        setPendingChanges((n) => n + 1);
        return;
      }

      if (isCmd || !buildMode) return;
      if (e.key === "b" || e.key === "B") { e.preventDefault(); setTool("grass"); }
      if (e.key === "e" || e.key === "E") { e.preventDefault(); setTool("erase"); }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); setTool("fill"); }
      if (e.key === "Escape") { setBuildMode(false); setPendingChanges(0); undoStack.current = []; redoStack.current = []; }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [buildMode]);

  return (
    <div
      ref={containerRef}
      className="office-scene relative w-full h-full bg-cover bg-center bg-no-repeat [image-rendering:pixelated] overflow-hidden cursor-default"
      style={{
        backgroundImage:
          "url('https://img.itch.zone/aW1nLzEwNDk2NzQ4LnBuZw==/original/eqMZWi.png')",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Transform wrapper: pan + zoom applied here, OfficeMap anchored at 0,0 */}
      {usePixiRenderer ? (
        <>
          {/* PixiJS visual layer — camera controlled via panX/panY/zoom props */}
          {containerSize && (
            <OfficePixiCanvas
              width={containerSize.w}
              height={containerSize.h}
              panX={panX}
              panY={panY}
              zoom={zoom}
              grid={grid}
              decorations={decorations}
              grassColor={grassColor}
              agentPositions={agentPositions}
              agentsById={agentsById}
              agentSearch={agentSearch}
              isMultiInstance={isMultiInstance}
              rosterInstances={rosterInstances}
              spendByInstance={spendByInstance}
            />
          )}
          {/* Interaction overlay — same world transform, handles build mode + agent clicks */}
          <div
            className="absolute left-0 top-0 origin-top-left pointer-events-none"
            style={{
              width: GRID_COLS * TILE,
              height: GRID_ROWS * TILE,
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            }}
          >
            <OfficeMapOverlay
              grid={grid}
              decorations={decorations}
              agentPositions={agentPositions}
              agentsById={agentsById}
              buildMode={buildMode}
              tool={tool}
              visibleRange={visibleCellRange}
              onCellClick={onCellClick}
              onAgentClick={onAgentClick}
            />
          </div>
        </>
      ) : (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: GRID_COLS * TILE,
            height: GRID_ROWS * TILE,
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
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
            agentSearch={agentSearch}
            onCellClick={onCellClick}
            onAgentDrop={onAgentDrop}
            onAgentClick={onAgentClick}
            rosterInstances={rosterInstances}
            isMultiInstance={isMultiInstance}
            spendByInstance={spendByInstance}
            visibleRange={visibleCellRange}
          />
        </div>
      )}

      {/* Canvas tools - top-left: zoom + recenter (hidden in build mode) */}
      <AnimatePresence initial={false}>
        {!buildMode && (
          <motion.div
            key="canvas-tools"
            className="canvas-tools absolute flex items-center gap-[6px] z-[10] pointer-events-auto top-[14px] left-[14px] bg-[rgba(20,16,14,0.95)] border border-[rgba(255,240,230,0.12)] rounded-[8px] p-[4px]"
            initial={{ opacity: 0, scale: 0.85, x: -6, y: -6 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0, transition: { type: "spring", stiffness: 300, damping: 26 } }}
            exit={{ opacity: 0, scale: 0.8, x: -6, y: -6, transition: { duration: 0.13, ease: "easeIn", delay: 0.04 } }}
          >
            <button
              type="button"
              className="inline-flex items-center gap-[4px] px-[8px] py-[5px] rounded-[5px] text-[rgba(199,191,183,0.9)] text-[11.5px] font-mono transition-[background,color] duration-100 hover:bg-[rgba(255,240,230,0.08)] hover:text-[#f4efea]"
              onClick={() => zoomBy(1 - ZOOM_STEP)}
              aria-label="Zoom out"
            >
              <Icon name="minus" size={11} />
            </button>
            <div
              className="text-center cursor-pointer px-[8px] py-[2px] text-[rgba(199,191,183,0.9)] font-mono text-[11px] min-w-[40px] hover:text-[#f4efea]"
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
              className="inline-flex items-center gap-[4px] px-[8px] py-[5px] rounded-[5px] text-[rgba(199,191,183,0.9)] text-[11.5px] font-mono transition-[background,color] duration-100 hover:bg-[rgba(255,240,230,0.08)] hover:text-[#f4efea]"
              onClick={() => zoomBy(1 + ZOOM_STEP)}
              aria-label="Zoom in"
            >
              <Icon name="plus" size={11} />
            </button>
            <div className="shrink-0 w-[1px] h-[16px] bg-[rgba(255,240,230,0.10)] mx-[2px]" />
            <button
              type="button"
              className="inline-flex items-center gap-[4px] px-[8px] py-[5px] rounded-[5px] text-[rgba(199,191,183,0.9)] text-[11.5px] font-mono transition-[background,color] duration-100 hover:bg-[rgba(255,240,230,0.08)] hover:text-[#f4efea]"
              title="Recenter"
              onClick={resetCamera}
            >
              <Icon name="crosshair" size={13} />
            </button>
            <div className="shrink-0 w-[1px] h-[16px] bg-[rgba(255,240,230,0.10)] mx-[2px]" />
            <input
              className="bg-transparent border-none outline-none text-[rgba(199,191,183,0.9)] font-mono text-[11px] w-[110px] px-[4px] py-[2px] focus:text-[#f4efea] placeholder:text-[rgba(199,191,183,0.4)]"
              type="search"
              placeholder="Find agent…"
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              aria-label="Search agents"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* View toggle - top-left below zoom bar (hidden in build mode) */}
      <AnimatePresence initial={false}>
        {!buildMode && (
          <motion.div
            key="view-toggle"
            className="absolute flex items-center z-[10] pointer-events-auto top-[14px] right-[14px] bg-[rgba(20,16,14,0.95)] border border-[rgba(255,240,230,0.12)] rounded-[8px] p-[4px] gap-[2px]"
            initial={{ opacity: 0, scale: 0.85, x: 6, y: -6 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0, transition: { type: "spring", stiffness: 300, damping: 26, delay: 0.05 } }}
            exit={{ opacity: 0, scale: 0.8, x: 6, y: -6, transition: { duration: 0.13, ease: "easeIn", delay: 0.07 } }}
          >
            <button
              type="button"
              className={`inline-flex items-center gap-[4px] px-[8px] py-[5px] rounded-[5px] text-[11.5px] font-mono transition-[background,color] duration-100 ${view === "iso" ? "bg-[rgba(255,240,230,0.12)] text-[#f4efea]" : "text-[rgba(199,191,183,0.9)] hover:bg-[rgba(255,240,230,0.08)] hover:text-[#f4efea]"}`}
              onClick={() => setView("iso")}
            >
              <Icon name="map" size={11} /> Iso
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-[4px] px-[8px] py-[5px] rounded-[5px] text-[11.5px] font-mono transition-[background,color] duration-100 ${view === "cards" ? "bg-[rgba(255,240,230,0.12)] text-[#f4efea]" : "text-[rgba(199,191,183,0.9)] hover:bg-[rgba(255,240,230,0.08)] hover:text-[#f4efea]"}`}
              onClick={() => setView("cards")}
            >
              <Icon name="grid" size={11} /> Cards
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas info - bottom-left: tile coords + map stats (hidden in build mode) */}
      <AnimatePresence initial={false}>
        {!buildMode && (
          <motion.div
            key="canvas-info"
            className="canvas-info absolute flex z-[10] pointer-events-none bottom-[14px] left-[14px] gap-[14px] px-[12px] py-[8px] bg-[rgba(20,16,14,0.95)] border border-[rgba(255,240,230,0.12)] rounded-[8px] font-mono text-[10.5px] text-[rgba(138,128,121,0.9)]"
            initial={{ opacity: 0, scale: 0.85, x: -6, y: 6 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0, transition: { type: "spring", stiffness: 300, damping: 26, delay: 0.1 } }}
            exit={{ opacity: 0, scale: 0.8, x: -6, y: 6, transition: { duration: 0.13, ease: "easeIn", delay: 0.1 } }}
          >
            <div className="item">
              <div className="uppercase tracking-[0.06em] text-[rgba(94,86,81,0.9)] text-[9.5px]">Tile</div>
              <div className="text-[rgba(244,239,234,0.9)]">{hoverTile ? `${hoverTile.x}, ${hoverTile.y}` : "-"}</div>
            </div>
            <div className="item">
              <div className="uppercase tracking-[0.06em] text-[rgba(94,86,81,0.9)] text-[9.5px]">Map</div>
              <div className="text-[rgba(244,239,234,0.9)]">{GRID_COLS} × {GRID_ROWS}</div>
            </div>
            <div className="item">
              <div className="uppercase tracking-[0.06em] text-[rgba(94,86,81,0.9)] text-[9.5px]">Placed</div>
              <div className="text-[rgba(244,239,234,0.9)]">{grassCount + decoCount} tiles</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Build actions bar - bottom-center, build mode only (wrapper handles centering, motion handles anim) */}
      <div className="absolute bottom-[14px] left-1/2 -translate-x-1/2 z-[15] pointer-events-none">
      <AnimatePresence>
        {buildMode && (
          <motion.div
            key="done-bar"
            className="build-actions-bar flex items-center gap-[4px] pointer-events-auto whitespace-nowrap rounded-full p-[5px] bg-[rgba(26,22,20,0.97)] border border-[rgba(255,240,230,0.14)] shadow-[0_14px_40px_-10px_rgba(0,0,0,0.7)]"
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 360, damping: 28, delay: 0.32 } }}
            exit={{ opacity: 0, scale: 0.5, y: 20, transition: { duration: 0.12, ease: "easeIn" } }}
          >
            <button
              type="button"
              className="inline-flex items-center gap-[7px] rounded-full font-semibold px-[16px] py-[8px] text-[12.5px] transition-[background,color] duration-[120ms] bg-[rgba(255,240,230,0.08)] border border-[rgba(255,240,230,0.12)] text-[rgba(244,239,234,0.9)] hover:bg-[rgba(255,240,230,0.12)]"
              onClick={() => { setBuildMode(false); setPendingChanges(0); undoStack.current = []; redoStack.current = []; }}
            >
              {pendingChanges > 0 && <span className="rounded-full shrink-0 w-[6px] h-[6px] bg-[#e6b35a] shadow-[0_0_6px_#e6b35a]" />}
              <Icon name="check" size={13} />
              Done{pendingChanges > 0 ? ` · ${pendingChanges} saved` : ""}
            </button>
            {projectId && (
              <>
                <div className="shrink-0 w-[1px] h-[20px] bg-[rgba(255,240,230,0.10)] mx-[2px]" />
                <button
                  type="button"
                  className={`inline-flex items-center gap-[5px] rounded-full bg-transparent cursor-pointer font-medium text-[12px] px-[11px] py-[5px] border border-[rgba(255,240,230,0.15)] text-[rgba(255,240,230,0.55)] transition-[background,color,border-color] duration-100 hover:bg-[rgba(255,240,230,0.07)] hover:text-[rgba(255,240,230,0.8)]${useCustomMap ? " !border-[rgba(233,84,32,0.5)] !bg-[rgba(233,84,32,0.12)] !text-[#e95420]" : ""}`}
                  title={
                    useCustomMap
                      ? "Switch back to the default shared layout (used by all projects)"
                      : "Create a project-specific layout for this project"
                  }
                  onClick={useCustomMap ? disableCustomMap : enableCustomMap}
                >
                  <Icon name="map" size={12} />
                  {useCustomMap ? "Project layout" : "Default layout"}
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      <OfficeBuildToolbar
        active={buildMode}
        tool={tool}
        grassColor={grassColor}
        onToggle={onBuildToggle}
        onSelectTool={setTool}
        onSelectGrassColor={setGrassColor}
      />
    </div>
  );
}
