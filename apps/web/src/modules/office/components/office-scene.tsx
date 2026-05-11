"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OfficeMap, type AgentPositions } from "./office-map";
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

/**
 * Canvas for the new game-asset-based office view. Owns the editable
 * tile grid + decorations map + builder UI state.
 *
 * Both grid and decorations persist to localStorage on every edit so the
 * user's build survives refreshes. Decoration placement is gated by
 * terrain: land decorations (bush, rock, tree) only on grass cells,
 * water decorations (water rock, duck) only on water cells. Mismatched
 * clicks are no-ops so the user can tell the wrong tool is selected.
 *
 * Erase: removes a decoration first if one is present, otherwise clears
 * the terrain. Two clicks fully empty a decorated grass cell.
 */

const GRID_COLS = 16;
const GRID_ROWS = 10;
const GRID_STORAGE_KEY = "agent-office:office-grid:v1";
const DECO_STORAGE_KEY = "agent-office:office-decorations:v1";
const AGENTS_STORAGE_KEY = "agent-office:office-agents:v1";

/** Default grid is empty — users build their own island. Existing
 *  localStorage from earlier seed-island sessions still loads as before. */
function makeSeedGrid(): boolean[][] {
  return Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => false),
  );
}

function loadGrid(): boolean[][] {
  if (typeof window === "undefined") return makeSeedGrid();
  try {
    const raw = window.localStorage.getItem(GRID_STORAGE_KEY);
    if (!raw) return makeSeedGrid();
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
  } catch {
    /* fall through */
  }
  return makeSeedGrid();
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

function loadDecorations(): DecorationsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DECO_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: DecorationsMap = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        // Old shape (pre-stacking): single string per cell. Wrap it.
        if (typeof value === "string") {
          const migrated = migrateKind(value);
          if (migrated) out[key] = [migrated];
          continue;
        }
        // New shape: ordered array of kinds.
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
    }
  } catch {
    /* fall through */
  }
  return {};
}

function loadAgentPositions(): AgentPositions {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(AGENTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: AgentPositions = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          typeof (value as { agentId?: unknown }).agentId === "string"
        ) {
          const v = value as { agentId: string; instanceId?: unknown };
          out[key] = {
            agentId: v.agentId,
            instanceId: typeof v.instanceId === "string" ? v.instanceId : undefined,
          };
        }
      }
      return out;
    }
  } catch {
    /* fall through */
  }
  return {};
}

export function OfficeScene() {
  const [grid, setGrid] = useState<boolean[][]>(() => loadGrid());
  const [decorations, setDecorations] = useState<DecorationsMap>(() => loadDecorations());
  const [agentPositions, setAgentPositions] = useState<AgentPositions>(() =>
    loadAgentPositions(),
  );
  const [buildMode, setBuildMode] = useState(false);
  const [tool, setTool] = useState<BuildTool>("grass");

  const { agents } = useOfficeAgents();
  const agentsById = useMemo(() => {
    const m = new Map<string, (typeof agents)[number]>();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(GRID_STORAGE_KEY, JSON.stringify(grid));
    } catch {
      /* best-effort */
    }
  }, [grid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DECO_STORAGE_KEY, JSON.stringify(decorations));
    } catch {
      /* best-effort */
    }
  }, [decorations]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(AGENTS_STORAGE_KEY, JSON.stringify(agentPositions));
    } catch {
      /* best-effort */
    }
  }, [agentPositions]);

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
          }
          return;
        }
        if (cellHasGrass) {
          setGrid((prev) => {
            const next = prev.map((row) => [...row]);
            next[y]![x] = false;
            return next;
          });
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
    },
    [grid, decorations, agentPositions, tool],
  );

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
      }}
    >
      <OfficeMap
        grid={grid}
        decorations={decorations}
        agentPositions={agentPositions}
        agentsById={agentsById}
        editable={buildMode}
        tool={tool}
        onCellClick={onCellClick}
        onAgentDrop={onAgentDrop}
        onAgentClick={onAgentClick}
      />
      <OfficeBuildToolbar
        active={buildMode}
        tool={tool}
        onToggle={() => setBuildMode((m) => !m)}
        onSelectTool={setTool}
      />
    </div>
  );
}
