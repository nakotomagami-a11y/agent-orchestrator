"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { OfficeMap, TILE, type AgentPositions, type VisibleRange } from "./office-map";
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
  const queue: [number, number][] = [[startX, startY]];
  const visited = new Set<string>();
  let count = 0;
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) continue;
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

export function OfficeScene({ projectId }: { projectId: string | null }) {
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
  // Keep a ref to current state so the keyboard handler can push to redo
  // without capturing stale closure values.
  const currentStateRef = useRef<Snapshot>({ grid, decorations, agentPositions });
  useEffect(() => {
    currentStateRef.current = { grid, decorations, agentPositions };
  }, [grid, decorations, agentPositions]);

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
  // Falls back to full grid until the ResizeObserver fires.
  const visibleCellRange = useMemo<VisibleRange>(() => {
    if (!containerSize) return { xMin: 0, xMax: GRID_COLS - 1, yMin: 0, yMax: GRID_ROWS - 1 };
    const OVERSCAN = 2;
    const xMin = Math.max(0, Math.floor(-panX / zoom / TILE) - OVERSCAN);
    const xMax = Math.min(GRID_COLS - 1, Math.ceil((-panX + containerSize.w) / zoom / TILE) + OVERSCAN);
    const yMin = Math.max(0, Math.floor(-panY / zoom / TILE) - OVERSCAN);
    const yMax = Math.min(GRID_ROWS - 1, Math.ceil((-panY + containerSize.h) / zoom / TILE) + OVERSCAN);
    return { xMin, xMax, yMin, yMax };
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
          try {
            const parsed = JSON.parse(data[gridKey]) as unknown;
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
        if (data[decoKey]) {
          try {
            const parsed = JSON.parse(data[decoKey]) as unknown;
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
        if (data[agentKey]) {
          try {
            const parsed = JSON.parse(data[agentKey]) as unknown;
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
          setGrid((prev) => {
            const next = prev.map((row) => [...row]);
            for (let cy = yMin; cy <= yMax; cy++)
              for (let cx = xMin; cx <= xMax; cx++)
                next[cy]![cx] = true;
            return next;
          });
        } else {
          setGrid((prev) => {
            const next = prev.map((row) => [...row]);
            for (let cy = yMin; cy <= yMax; cy++)
              for (let cx = xMin; cx <= xMax; cx++)
                next[cy]![cx] = false;
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
        setGrid((prev) => {
          const next = prev.map((row) => [...row]);
          next[y]![x] = true;
          return next;
        });
        setPendingChanges((n) => n + 1);
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
        return;
      }

      if (tool === "fill") {
        if (cellHasGrass) return;
        const [newGrid, count] = floodFill(grid, x, y);
        if (count === 0) return;
        undoStack.current = [...undoStack.current.slice(-49), { grid, decorations, agentPositions }];
        redoStack.current = [];
        setGrid(newGrid);
        setPendingChanges((n) => n + count);
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
            // If a bridge was removed from a water cell, evict any agent
            // standing on it - they can't stand on water.
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
          setGrid((prev) => {
            const next = prev.map((row) => [...row]);
            next[y]![x] = false;
            return next;
          });
          setPendingChanges((n) => n + 1);
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
    [grid, decorations, agentPositions, tool, rectStart],
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
  const disableCustomMap = useCallback(() => {
    if (!projectId) return;
    setSceneLoaded(false); // block saves while we reload global state
    setUseCustomMap(false);
    fetch("/api/ui-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [`office-map-custom:${projectId}`]: "false" }),
    }).catch(() => {});
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
        } else {
          setGrid(makeSeedGrid());
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
        } else {
          setDecorations({});
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

      {/* Canvas tools - top-left: zoom + recenter */}
      <div className="canvas-tools absolute flex items-center gap-[6px] z-[10] pointer-events-auto top-[14px] left-[14px] bg-[rgba(20,16,14,0.88)] border border-[rgba(255,240,230,0.12)] rounded-[8px] p-[4px] backdrop-blur-[10px]">
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
        {!buildMode && (
          <>
            <div className="shrink-0 w-[1px] h-[16px] bg-[rgba(255,240,230,0.10)] mx-[2px]" />
            <input
              className="bg-transparent border-none outline-none text-[rgba(199,191,183,0.9)] font-mono text-[11px] w-[110px] px-[4px] py-[2px] focus:text-[#f4efea] placeholder:text-[rgba(199,191,183,0.4)]"
              type="search"
              placeholder="Find agent…"
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              aria-label="Search agents"
            />
          </>
        )}
      </div>

      {/* Canvas info - bottom-left: tile coords + map stats */}
      {(() => {
        const grassCount = grid.flat().filter(Boolean).length;
        const decoCount  = Object.values(decorations).reduce((s, stack) => s + (stack?.length ?? 0), 0);
        const placedCount = grassCount + decoCount;
        return (
          <div className="canvas-info absolute flex z-[10] pointer-events-none bottom-[14px] left-[14px] gap-[14px] px-[12px] py-[8px] bg-[rgba(20,16,14,0.88)] border border-[rgba(255,240,230,0.12)] rounded-[8px] font-mono text-[10.5px] text-[rgba(138,128,121,0.9)] backdrop-blur-[10px]">
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
              <div className="text-[rgba(244,239,234,0.9)]">{placedCount} tiles</div>
            </div>
            {buildMode && rectStart && (
              <div className="item">
                <div className="uppercase tracking-[0.06em] text-[rgba(94,86,81,0.9)] text-[9.5px]">Rect</div>
                <div className="text-[rgba(244,239,234,0.9)]">{rectStart.x},{rectStart.y} → shift+click</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Build actions bar - bottom-center, build mode only */}
      {buildMode && (
        <div className="build-actions-bar absolute flex items-center gap-[4px] z-[15] pointer-events-auto whitespace-nowrap rounded-full bottom-[14px] left-1/2 [transform:translateX(-50%)] p-[5px] bg-[rgba(26,22,20,0.92)] border border-[rgba(255,240,230,0.14)] shadow-[0_14px_40px_-10px_rgba(0,0,0,0.7)] backdrop-blur-[12px]">
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
        </div>
      )}

      <OfficeBuildToolbar
        active={buildMode}
        tool={tool}
        grassColor={grassColor}
        onToggle={() => { setBuildMode((m) => { if (!m) setAgentSearch(""); return !m; }); setPendingChanges(0); }}
        onSelectTool={setTool}
        onSelectGrassColor={setGrassColor}
      />
    </div>
  );
}
