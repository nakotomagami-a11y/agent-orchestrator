"use client";

import { useCallback, useEffect, useMemo, useRef, startTransition, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { TILE, isToolValidAt, type AgentPositions, type VisibleRange } from "./office-map";
import { OfficeMapOverlay } from "./office-map-overlay";
import { OfficePixiCanvas } from "./office-pixi-canvas";
import { OfficeBuildToolbar, type BuildTool, type LandGenParams } from "./office-build-toolbar";
import { generateLand } from "../derive/land-generator";
import {
  DECORATIONS,
  applyPlacement,
  decorationKey,
  familyOf,
  footprintCenterShift,
  popDecoration,
  type DecorationsMap,
  type DecoInstance,
  type BuildingColor,
} from "./decorations";
import { DecoSelectMenu } from "./deco-select-menu";
import { AgentSelectMenu } from "./agent-select-menu";
import { useOfficeAgents } from "../hooks/use-office-agents";
import { useOfficeStore } from "../hooks/use-office-store";
import { dragRefKey, type DragRef } from "../hooks/use-office-drag";
import { useOfficeAutoSave } from "../hooks/use-office-auto-save";
import { getUiSettings, patchUiSettings } from "@/lib/api/ui-settings";
import { useOfficeKeyboardShortcuts } from "../hooks/use-office-keyboard-shortcuts";
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
import {

  parseGrid,
  parseDecorations,
  parseAgentPositions,
  makeSeedGrid,
  floodFill,
  type Snapshot,
  EMPTY_ROSTER,
  EMPTY_SPEND,
} from "../derive/office-scene-data";
import { loadMapLocal, saveMapLocal } from "../derive/office-map-storage";

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


export function OfficeScene({
  projectId,
}: {
  projectId: string | null;
}) {
  // Synchronous localStorage read — the map is available on the very first
  // render, so it always survives a reload without waiting on the server.
  const [initialLocal] = useState(() => loadMapLocal(projectId));
  const [grid, setGrid] = useState<boolean[][]>(() => initialLocal?.grid ?? makeSeedGrid());
  const [decorations, setDecorations] = useState<DecorationsMap>(() => initialLocal?.decorations ?? {});
  const [agentPositions, setAgentPositions] = useState<AgentPositions>(() => initialLocal?.agentPositions ?? {});
  const [buildMode, setBuildMode] = useState(false);
  const [tool, setTool] = useState<BuildTool | null>(null);
  const [grassColor, setGrassColor] = useState<GrassColor>(() => initialLocal?.grassColor ?? DEFAULT_GRASS_COLOR);
  const [sceneLoaded, setSceneLoaded] = useState(false);
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);
  const [hoveredAgentKey, setHoveredAgentKey] = useState<string | null>(null);
  const [hoveredDecoKey, setHoveredDecoKey] = useState<string | null>(null);
  // Free-hand select tool: which placed decoration instance is selected.
  const [selectedDeco, setSelectedDeco] = useState<{ key: string; index: number } | null>(null);
  // Select tool: which placed agent (by "x,y" cell key) is selected for editing.
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
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
    focusOn,
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
    getUiSettings()
      .then((data) => {
        const customMap = projectId
          ? data[`office-map-custom:${projectId}`] === "true"
          : false;
        if (customMap) setUseCustomMap(true);

        // localStorage is authoritative for the map once present. Only migrate
        // from the server when there's no local copy yet (first load / new device).
        if (initialLocal) return;

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
      .finally(() => setSceneLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount; projectId change triggers remount via key
  }, []);

  const { agents } = useOfficeAgents();
  const agentsById = useMemo(() => {
    const m = new Map<string, (typeof agents)[number]>();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);

  // Elastic agent search → dropdown of matching placed agents.
  const [searchOpen, setSearchOpen] = useState(false);
  const searchMatches = useMemo(() => {
    const q = agentSearch.toLowerCase().trim();
    if (!q) return [] as { key: string; x: number; y: number; name: string }[];
    const out: { key: string; x: number; y: number; name: string }[] = [];
    for (const [key, ref] of Object.entries(agentPositions)) {
      const agent = agentsById.get(ref.agentId);
      if (!agent || !agent.name.toLowerCase().includes(q)) continue;
      const [xs, ys] = key.split(",");
      out.push({ key, x: Number(xs), y: Number(ys), name: agent.name });
    }
    return out.slice(0, 8);
  }, [agentSearch, agentPositions, agentsById]);

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
  useOfficeAutoSave({ sceneLoaded, useCustomMap, projectId, grid, decorations, agentPositions, grassColor });

  // Primary persistence: write the whole map to localStorage (debounced). This
  // is what makes the map survive a reload reliably, independent of the server.
  useEffect(() => {
    if (!sceneLoaded) return;
    const t = setTimeout(() => {
      saveMapLocal(projectId, { grid, decorations, grassColor, agentPositions });
    }, 300);
    return () => clearTimeout(t);
  }, [grid, decorations, grassColor, agentPositions, sceneLoaded, projectId]);

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
      // Free-hand select never paints — decoration hit-targets in the overlay
      // handle selection. A click on empty ground just clears the selection.
      if (tool === "select") { setSelectedDeco(null); return; }

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
            const kept = existing.filter((k) => DECORATIONS[k.kind].terrain === "land");
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
            const bridgeGone = isWater && !popped.stack.some((k) => familyOf(k.kind) === "bridge");
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

      // Decoration tool: validate terrain, bridge ramps, and (for multi-tile
      // buildings) that the whole footprint is clear land.
      if (!isToolValidAt(tool, x, y, grid, decorations)) return;
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
        // Guard: element may have been unmounted between the pointermove and this
        // rAF callback. getBoundingClientRect() returns a zeroed rect for detached
        // elements, producing out-of-bounds tile coordinates.
        if (!el.isConnected) return;
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

  // Toolbar undo/redo/reset — same stacks the keyboard shortcuts use.
  const onUndo = useCallback(() => {
    const snapshot = undoStack.current.pop();
    if (!snapshot) return;
    redoStack.current.push(currentStateRef.current);
    setGrid(snapshot.grid);
    setDecorations(snapshot.decorations);
    setAgentPositions(snapshot.agentPositions);
    setRectStart(null);
    setPendingChanges((n) => n + 1);
  }, []);

  const onRedo = useCallback(() => {
    const snapshot = redoStack.current.pop();
    if (!snapshot) return;
    undoStack.current.push(currentStateRef.current);
    setGrid(snapshot.grid);
    setDecorations(snapshot.decorations);
    setAgentPositions(snapshot.agentPositions);
    setRectStart(null);
    setPendingChanges((n) => n + 1);
  }, []);

  const onResetCanvas = useCallback(() => {
    if (!window.confirm("Reset the canvas? This clears all decorations and placed agents and fills the map with grass.")) return;
    undoStack.current = [...undoStack.current.slice(-49), currentStateRef.current];
    redoStack.current = [];
    setGrid(Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => true)));
    setDecorations({});
    setAgentPositions({});
    setRectStart(null);
    setPendingChanges((n) => n + 1);
  }, []);

  const onGenerateLand = useCallback((opts: LandGenParams) => {
    const { grid, decorations, agentPositions } = currentStateRef.current;
    undoStack.current = [...undoStack.current.slice(-49), { grid, decorations, agentPositions }];
    redoStack.current = [];
    setGrid(generateLand({ ...opts, cols: GRID_COLS, rows: GRID_ROWS }));
    setRectStart(null);
    setPendingChanges((n) => n + 1);
  }, []);

  // ── Free-hand decoration editing (rotate / mirror / nudge / delete) ─────────
  const NUDGE_MAX = TILE; // clamp per-instance offset to ±1 tile
  const mutateDeco = useCallback(
    (key: string, index: number, fn: (inst: DecoInstance) => DecoInstance | null) => {
      const { grid, decorations, agentPositions } = currentStateRef.current;
      undoStack.current = [...undoStack.current.slice(-49), { grid, decorations, agentPositions }];
      redoStack.current = [];
      setDecorations((prev) => {
        const stack = prev[key];
        if (!stack || !stack[index]) return prev;
        const updated = fn(stack[index]!);
        const nextStack = [...stack];
        if (updated === null) nextStack.splice(index, 1);
        else nextStack[index] = updated;
        const next = { ...prev };
        if (nextStack.length === 0) delete next[key];
        else next[key] = nextStack;
        return next;
      });
      setPendingChanges((n) => n + 1);
    },
    [],
  );

  const rotateSelected = useCallback(() => {
    if (!selectedDeco) return;
    mutateDeco(selectedDeco.key, selectedDeco.index, (inst) => ({
      ...inst,
      rot: (((inst.rot ?? 0) + 1) % 3) as 0 | 1 | 2,
    }));
  }, [selectedDeco, mutateDeco]);

  const flipSelected = useCallback(() => {
    if (!selectedDeco) return;
    mutateDeco(selectedDeco.key, selectedDeco.index, (inst) => ({ ...inst, flip: !inst.flip }));
  }, [selectedDeco, mutateDeco]);

  const colorSelected = useCallback((color: BuildingColor) => {
    if (!selectedDeco) return;
    mutateDeco(selectedDeco.key, selectedDeco.index, (inst) => ({
      ...inst,
      color: color === "blue" ? undefined : color,
    }));
  }, [selectedDeco, mutateDeco]);

  const restackSelected = useCallback((delta: number) => {
    if (!selectedDeco) return;
    mutateDeco(selectedDeco.key, selectedDeco.index, (inst) => {
      const z = (inst.z ?? 0) + delta;
      return { ...inst, z: z === 0 ? undefined : z };
    });
  }, [selectedDeco, mutateDeco]);

  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      if (!selectedDeco) return;
      const clamp = (v: number) => Math.max(-NUDGE_MAX, Math.min(NUDGE_MAX, v));
      mutateDeco(selectedDeco.key, selectedDeco.index, (inst) => ({
        ...inst,
        dx: clamp((inst.dx ?? 0) + dx),
        dy: clamp((inst.dy ?? 0) + dy),
      }));
    },
    [selectedDeco, mutateDeco, NUDGE_MAX],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedDeco) return;
    mutateDeco(selectedDeco.key, selectedDeco.index, () => null);
    setSelectedDeco(null);
  }, [selectedDeco, mutateDeco]);

  // Stable callbacks so OfficeMapOverlay's memo holds across camera pans.
  const selectDeco = useCallback((key: string, index: number) => { setSelectedAgent(null); setSelectedDeco({ key, index }); }, []);
  const deselectDeco = useCallback(() => setSelectedDeco(null), []);

  // Drag-to-reposition: overlay records the drag; on the first move it calls
  // beginDecoDrag (one undo snapshot + select), then setDecoOffset live (no more
  // snapshots) until pointer-up.
  const beginDecoDrag = useCallback((key: string, index: number) => {
    const { grid, decorations, agentPositions } = currentStateRef.current;
    undoStack.current = [...undoStack.current.slice(-49), { grid, decorations, agentPositions }];
    redoStack.current = [];
    setSelectedDeco({ key, index });
  }, []);

  const setDecoOffset = useCallback((key: string, index: number, dx: number, dy: number) => {
    const clamp = (v: number) => Math.max(-NUDGE_MAX, Math.min(NUDGE_MAX, Math.round(v)));
    setDecorations((prev) => {
      const stack = prev[key];
      if (!stack || !stack[index]) return prev;
      const ns = [...stack];
      ns[index] = { ...ns[index]!, dx: clamp(dx), dy: clamp(dy) };
      return { ...prev, [key]: ns };
    });
    setPendingChanges((n) => n + 1);
  }, [NUDGE_MAX]);

  // ── Agent editing (select tool): mirror, layer/z, pixel nudge ──────────────
  const mutateAgent = useCallback(
    (key: string, fn: (a: AgentPositions[string]) => AgentPositions[string]) => {
      const { grid, decorations, agentPositions } = currentStateRef.current;
      undoStack.current = [...undoStack.current.slice(-49), { grid, decorations, agentPositions }];
      redoStack.current = [];
      setAgentPositions((prev) => {
        const cur = prev[key];
        if (!cur) return prev;
        return { ...prev, [key]: fn(cur) };
      });
      setPendingChanges((n) => n + 1);
    },
    [],
  );

  const flipAgent = useCallback(() => {
    if (!selectedAgent) return;
    mutateAgent(selectedAgent, (a) => ({ ...a, flip: a.flip ? undefined : true }));
  }, [selectedAgent, mutateAgent]);

  const restackAgent = useCallback((delta: number) => {
    if (!selectedAgent) return;
    mutateAgent(selectedAgent, (a) => {
      const z = (a.z ?? 0) + delta;
      return { ...a, z: z === 0 ? undefined : z };
    });
  }, [selectedAgent, mutateAgent]);

  const nudgeAgent = useCallback((dx: number, dy: number) => {
    if (!selectedAgent) return;
    const clamp = (v: number) => Math.max(-NUDGE_MAX, Math.min(NUDGE_MAX, v));
    mutateAgent(selectedAgent, (a) => ({
      ...a,
      dx: clamp((a.dx ?? 0) + dx) || undefined,
      dy: clamp((a.dy ?? 0) + dy) || undefined,
    }));
  }, [selectedAgent, mutateAgent, NUDGE_MAX]);

  const selectAgentInstance = useCallback((key: string) => {
    setSelectedDeco(null);
    setSelectedAgent(key);
  }, []);

  const beginAgentDrag = useCallback((key: string) => {
    const { grid, decorations, agentPositions } = currentStateRef.current;
    undoStack.current = [...undoStack.current.slice(-49), { grid, decorations, agentPositions }];
    redoStack.current = [];
    setSelectedDeco(null);
    setSelectedAgent(key);
  }, []);

  const setAgentOffset = useCallback((key: string, dx: number, dy: number) => {
    const clamp = (v: number) => Math.max(-NUDGE_MAX, Math.min(NUDGE_MAX, Math.round(v)));
    setAgentPositions((prev) => {
      const cur = prev[key];
      if (!cur) return prev;
      return { ...prev, [key]: { ...cur, dx: clamp(dx) || undefined, dy: clamp(dy) || undefined } };
    });
    setPendingChanges((n) => n + 1);
  }, [NUDGE_MAX]);

  // Clear selection when leaving the select tool / build mode.
  useEffect(() => {
    if (tool !== "select" || !buildMode) { setSelectedDeco(null); setSelectedAgent(null); }
  }, [tool, buildMode]);

  // Keyboard: Escape deselects, Delete removes, R rotate, M mirror, arrows nudge.
  // Capture phase + stopImmediatePropagation so these win over the camera's
  // arrow-pan and the build-mode Escape (which would otherwise also fire).
  useEffect(() => {
    if (tool !== "select" || !selectedDeco) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const step = e.shiftKey ? 8 : 1;
      const claim = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      switch (e.key) {
        case "Escape": claim(); setSelectedDeco(null); break;
        case "Delete":
        case "Backspace": claim(); deleteSelected(); break;
        case "r": case "R": claim(); rotateSelected(); break;
        case "m": case "M": claim(); flipSelected(); break;
        case "ArrowLeft":  claim(); nudgeSelected(-step, 0); break;
        case "ArrowRight": claim(); nudgeSelected(step, 0); break;
        case "ArrowUp":    claim(); nudgeSelected(0, -step); break;
        case "ArrowDown":  claim(); nudgeSelected(0, step); break;
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [tool, selectedDeco, deleteSelected, nudgeSelected, rotateSelected, flipSelected]);

  // Same keyboard editing for a selected agent (mirror + nudge; no rotate/delete).
  useEffect(() => {
    if (tool !== "select" || !selectedAgent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const step = e.shiftKey ? 8 : 1;
      const claim = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      switch (e.key) {
        case "Escape": claim(); setSelectedAgent(null); break;
        case "m": case "M": claim(); flipAgent(); break;
        case "ArrowLeft":  claim(); nudgeAgent(-step, 0); break;
        case "ArrowRight": claim(); nudgeAgent(step, 0); break;
        case "ArrowUp":    claim(); nudgeAgent(0, -step); break;
        case "ArrowDown":  claim(); nudgeAgent(0, step); break;
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [tool, selectedAgent, flipAgent, nudgeAgent]);

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
    patchUiSettings({ [`office-map-custom:${projectId}`]: "true" }).catch(() => {});
  }, [projectId]);

  // Revert back to the shared global map layout for this project.
  // Chain the PATCH before the GET so we never read stale custom-flag state.
  const disableCustomMap = useCallback(() => {
    if (!projectId) return;
    setSceneLoaded(false); // block saves while we reload global state
    setUseCustomMap(false);
    patchUiSettings({ [`office-map-custom:${projectId}`]: "false" })
      .catch(() => {})
      .finally(() => {
        getUiSettings()
          .then((data) => {
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
      // Select tool edits the agent in place (handled via onAgentSelect) — never
      // open the conversation while editing the layout.
      if (buildMode && tool === "select") return;
      selectAgent(ref.agentId, { instanceId: ref.instanceId ?? null });
    },
    [buildMode, tool, selectAgent],
  );

  // Keyboard shortcuts for build mode: tool selection (B/E/F), Escape to exit,
  // and Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z for undo/redo.
  useOfficeKeyboardShortcuts({
    buildMode,
    undoStack,
    redoStack,
    currentStateRef,
    setGrid,
    setDecorations,
    setAgentPositions,
    setTool,
    setBuildMode,
    setRectStart,
    setPendingChanges,
  });

  return (
    <div
      ref={containerRef}
      className="office-scene relative w-full h-full [image-rendering:pixelated] overflow-hidden cursor-default"
      style={{ backgroundColor: "#47aca9" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Water shader — renders behind PixiJS; only active in iso view */}
      {/* <WaterShaderCanvas active={view === "iso"} zoomRef={zoomRef} panRef={panRef} /> */}

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
          hoveredAgentKey={hoveredAgentKey}
          hoveredDecoKey={hoveredDecoKey}
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
          onAgentDrop={onAgentDrop}
          onAgentHoverChange={setHoveredAgentKey}
          selectedDeco={selectedDeco}
          onDecoSelect={selectDeco}
          onDecoDeselect={deselectDeco}
          onDecoHoverChange={setHoveredDecoKey}
          zoom={zoom}
          onDecoDragStart={beginDecoDrag}
          onDecoOffset={setDecoOffset}
          selectedAgentKey={selectedAgent}
          onAgentSelect={selectAgentInstance}
          onAgentDragStart={beginAgentDrag}
          onAgentOffset={setAgentOffset}
        />
      </div>

      {/* Single selection menu — one dropdown anchored above the selected
          sprite (screen space, outside the zoomed overlay so it stays fixed). */}
      {buildMode && tool === "select" && selectedDeco && (() => {
        const inst = decorations[selectedDeco.key]?.[selectedDeco.index];
        if (!inst) return null;
        const [xs, ys] = selectedDeco.key.split(",");
        const cx = Number(xs);
        const cy = Number(ys);
        const def = DECORATIONS[inst.kind];
        const boxLeft = cx * TILE + (TILE - def.frameW) / 2 + footprintCenterShift(inst.kind) * TILE + (inst.dx ?? 0);
        const boxTop =
          (def.anchor === "center"
            ? cy * TILE + (TILE - def.frameH) / 2
            : (cy + 1) * TILE - def.frameH) + (inst.dy ?? 0);
        return (
          <DecoSelectMenu
            def={def}
            inst={inst}
            left={panX + (boxLeft + def.frameW / 2) * zoom}
            top={panY + boxTop * zoom}
            onRotate={rotateSelected}
            onMirror={flipSelected}
            onColor={colorSelected}
            onForward={() => restackSelected(1)}
            onBackward={() => restackSelected(-1)}
            onDelete={deleteSelected}
            onClose={() => setSelectedDeco(null)}
          />
        );
      })()}

      {/* Selected-agent menu — mirror / layer / nudge, anchored above the tile. */}
      {buildMode && tool === "select" && selectedAgent && (() => {
        const placement = agentPositions[selectedAgent];
        if (!placement) return null;
        const agent = agentsById.get(placement.agentId);
        if (!agent) return null;
        const [xs, ys] = selectedAgent.split(",");
        const cx = Number(xs);
        const cy = Number(ys);
        const anchorX = cx * TILE + TILE / 2 + (placement.dx ?? 0);
        const anchorY = cy * TILE - TILE * 0.6 + (placement.dy ?? 0);
        return (
          <AgentSelectMenu
            name={agent.name}
            flip={!!placement.flip}
            z={placement.z ?? 0}
            left={panX + anchorX * zoom}
            top={panY + anchorY * zoom}
            onMirror={flipAgent}
            onForward={() => restackAgent(1)}
            onBackward={() => restackAgent(-1)}
            onClose={() => setSelectedAgent(null)}
          />
        );
      })()}

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
            <div className="relative">
              <input
                className="bg-transparent border-none outline-none text-[rgba(199,191,183,0.9)] font-mono text-[11px] w-[110px] px-[4px] py-[2px] focus:text-[#f4efea] placeholder:text-[rgba(199,191,183,0.4)]"
                type="search"
                placeholder="Find agent…"
                value={agentSearch}
                onChange={(e) => { setAgentSearch(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
                aria-label="Search agents"
              />
              {searchOpen && searchMatches.length > 0 && (
                <div className="absolute left-0 top-[calc(100%+6px)] min-w-[180px] max-h-[240px] overflow-y-auto bg-[rgba(20,16,14,0.98)] border border-[rgba(255,240,230,0.12)] rounded-[8px] p-[4px] shadow-[var(--shadow-2)] [scrollbar-width:thin]">
                  {searchMatches.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      className="w-full flex items-center gap-[7px] text-left px-[8px] py-[6px] rounded-[5px] text-[rgba(199,191,183,0.9)] font-mono text-[11.5px] transition-[background,color] duration-100 hover:bg-[rgba(233,84,32,0.14)] hover:text-[#f4efea]"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { focusOn(m.x, m.y, 0.75); setSearchOpen(false); }}
                    >
                      <span className="w-[6px] h-[6px] rounded-full bg-[#ff2d1e] shrink-0" />
                      <span className="truncate">{m.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 w-[1px] h-[16px] bg-[rgba(255,240,230,0.10)] mx-[2px]" />
            <FpsCounter />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Build-mode FPS badge — the canvas-tools bar (which holds the FPS) hides
          in build mode, so a standalone FPS readout animates in to replace it. */}
      <AnimatePresence initial={false}>
        {buildMode && (
          <motion.div
            key="build-fps"
            className="absolute z-[10] pointer-events-none flex items-center top-[14px] left-[14px] bg-[rgba(20,16,14,0.95)] border border-[rgba(255,240,230,0.12)] rounded-[8px] px-[6px] py-[3px]"
            initial={{ opacity: 0, scale: 0.85, x: -6, y: -6 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0, transition: { type: "spring", stiffness: 300, damping: 26, delay: 0.16 } }}
            exit={{ opacity: 0, scale: 0.8, x: -6, y: -6, transition: { duration: 0.13, ease: "easeIn" } }}
          >
            <FpsCounter />
          </motion.div>
        )}
      </AnimatePresence>

      {/* View toggle - top-left below zoom bar (hidden in build mode) */}
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
        canUndo={undoStack.current.length > 0}
        canRedo={redoStack.current.length > 0}
        onUndo={onUndo}
        onRedo={onRedo}
        onReset={onResetCanvas}
        onGenerateLand={onGenerateLand}
      />
    </div>
  );
}

// Live FPS readout — rAF loop, updates the label ~4×/sec to avoid re-render spam.
function FpsCounter() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frames++;
      if (now - last >= 250) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const color = fps >= 50 ? "#7fd88a" : fps >= 30 ? "#e0c060" : "#e0705a";
  return (
    <div
      className="font-mono text-[11px] px-[6px] py-[2px] tabular-nums select-none"
      style={{ color }}
      title="Frames per second"
      aria-label={`${fps} frames per second`}
    >
      {fps} fps
    </div>
  );
}
