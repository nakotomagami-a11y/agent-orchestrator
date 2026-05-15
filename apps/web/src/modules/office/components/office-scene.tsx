"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { OfficeMap, TILE, type AgentPositions } from "./office-map";
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

/** Default grid is empty — users build their own island. */
function makeSeedGrid(): boolean[][] {
  return Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => false),
  );
}

export function OfficeScene({ projectId }: { projectId: string | null }) {
  const [grid, setGrid] = useState<boolean[][]>(() => makeSeedGrid());
  const [decorations, setDecorations] = useState<DecorationsMap>(() => ({}));
  const [agentPositions, setAgentPositions] = useState<AgentPositions>(() => ({}));
  const [buildMode, setBuildMode] = useState(false);
  const [tool, setTool] = useState<BuildTool>("grass");
  const [grassColor, setGrassColor] = useState<GrassColor>(() => DEFAULT_GRASS_COLOR);
  const [sceneLoaded, setSceneLoaded] = useState(false);
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [agentSearch, setAgentSearch] = useState("");
  const [useCustomMap, setUseCustomMap] = useState(false);

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
      // projectId is stable for this instance — the key prop forces a remount on change
      // eslint-disable-next-line react-hooks/exhaustive-deps
      .finally(() => setSceneLoaded(true));
  }, []);

  const { agents } = useOfficeAgents();
  const agentsById = useMemo(() => {
    const m = new Map<string, (typeof agents)[number]>();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);

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

  useEffect(() => {
    if (!sceneLoaded) return;
    const key = useCustomMap && projectId ? `office-grid:${projectId}` : "office-grid";
    fetch("/api/ui-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: JSON.stringify(grid) }),
    }).catch(() => { /* best-effort */ });
  }, [grid, sceneLoaded, useCustomMap, projectId]);

  useEffect(() => {
    if (!sceneLoaded) return;
    const key = useCustomMap && projectId ? `office-decorations:${projectId}` : "office-decorations";
    fetch("/api/ui-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: JSON.stringify(decorations) }),
    }).catch(() => { /* best-effort */ });
  }, [decorations, sceneLoaded, useCustomMap, projectId]);

  useEffect(() => {
    if (!sceneLoaded) return;
    const key = projectId ? `office-agents:${projectId}` : "office-agents";
    fetch("/api/ui-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: JSON.stringify(agentPositions) }),
    }).catch(() => { /* best-effort */ });
  }, [agentPositions, sceneLoaded, projectId]);

  useEffect(() => {
    if (!sceneLoaded) return;
    const key = useCustomMap && projectId ? `office-grass-color:${projectId}` : "office-grass-color";
    fetch("/api/ui-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: grassColor }),
    }).catch(() => { /* best-effort */ });
  }, [grassColor, sceneLoaded, useCustomMap, projectId]);

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

      if (tool === "erase") {
        // Topmost first: agent → decoration (LIFO from stack) → terrain
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
            // If a bridge was removed from a water cell, evict any agent
            // standing on it — they can't stand on water.
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
      setDecorations((prev) => {
        const stack = applyPlacement(prev[key], tool);
        return { ...prev, [key]: stack };
      });
      setPendingChanges((n) => n + 1);
    },
    [grid, decorations, agentPositions, tool],
  );

  // Keep ref in sync so pointer handlers can call the latest version
  useEffect(() => { onCellClickRef.current = onCellClick; }, [onCellClick, onCellClickRef]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (paintPointerDown(e)) return;
      camPointerDown(e);
    },
    [paintPointerDown, camPointerDown],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const wx = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
      const wy = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
      const tx = Math.floor(wx / TILE);
      const ty = Math.floor(wy / TILE);
      const inBounds = tx >= 0 && tx < GRID_COLS && ty >= 0 && ty < GRID_ROWS;
      setHoverTile(inBounds ? { x: tx, y: ty } : null);

      if (!paintPointerMove(e)) camPointerMove(e);
    },
    [paintPointerMove, camPointerMove, panRef, zoomRef],
  );

  const onPointerUp = useCallback(() => {
    paintPointerUp();
    camPointerUp();
  }, [paintPointerUp, camPointerUp]);

  // Drop handler — invoked by OfficeMap when an agent is dropped on a
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
          width: GRID_COLS * TILE,
          height: GRID_ROWS * TILE,
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
          agentSearch={agentSearch}
          onCellClick={onCellClick}
          onAgentDrop={onAgentDrop}
          onAgentClick={onAgentClick}
        />
      </div>

      {/* Canvas tools — top-left: zoom + recenter */}
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
        {!buildMode && (
          <>
            <div className="sep" />
            <input
              className="agent-search"
              type="search"
              placeholder="Find agent…"
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              aria-label="Search agents"
            />
          </>
        )}
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
          {projectId && (
            <>
              <div className="sep" />
              <button
                type="button"
                className={`map-scope${useCustomMap ? " on" : ""}`}
                title={
                  useCustomMap
                    ? "Switch back to the shared map layout"
                    : "Use a custom map layout for this project"
                }
                onClick={useCustomMap ? disableCustomMap : enableCustomMap}
              >
                <Icon name="map" size={12} />
                {useCustomMap ? "Custom map" : "Shared map"}
              </button>
            </>
          )}
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
        onToggle={() => { setBuildMode((m) => { if (!m) setAgentSearch(""); return !m; }); setPendingChanges(0); }}
        onSelectTool={setTool}
        onSelectGrassColor={setGrassColor}
      />
    </div>
  );
}
