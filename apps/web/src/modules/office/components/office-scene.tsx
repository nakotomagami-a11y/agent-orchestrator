"use client";

import { useCallback, useEffect, useState } from "react";
import { OfficeMap } from "./office-map";
import { OfficeBuildToolbar, type BuildTool } from "./office-build-toolbar";
import {
  DECORATIONS,
  decorationKey,
  isPlacementValid,
  type DecorationKind,
  type DecorationsMap,
} from "./decorations";

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

const INITIAL_ISLAND = [
  "..XXXXXXXX..",
  ".XXXXXXXXXX.",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  ".XXXXXXXXXX.",
  "..XXXXXXXX..",
] as const;
const ISLAND_OFFSET_X = 2;
const ISLAND_OFFSET_Y = 1;

function makeSeedGrid(): boolean[][] {
  const grid: boolean[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => false),
  );
  for (let y = 0; y < INITIAL_ISLAND.length; y++) {
    const row = INITIAL_ISLAND[y]!;
    for (let x = 0; x < row.length; x++) {
      grid[y + ISLAND_OFFSET_Y]![x + ISLAND_OFFSET_X] = row[x] === "X";
    }
  }
  return grid;
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

function loadDecorations(): DecorationsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DECO_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: DecorationsMap = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string" && value in DECORATIONS) {
          out[key] = value as DecorationKind;
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
  const [buildMode, setBuildMode] = useState(false);
  const [tool, setTool] = useState<BuildTool>("grass");

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
        // Defensive: if a water decoration was somehow on this cell (only
        // possible across schema changes), clear it.
        setDecorations((prev) => {
          const existing = prev[key];
          if (existing && DECORATIONS[existing].terrain === "water") {
            const next = { ...prev };
            delete next[key];
            return next;
          }
          return prev;
        });
        return;
      }

      if (tool === "erase") {
        // Decoration first, terrain second — two clicks to fully clear a
        // decorated grass cell.
        if (decorations[key]) {
          setDecorations((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
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

      // Decoration tool: validate against current terrain. Mismatched
      // clicks are no-ops so the user can see the wrong tool is selected.
      if (!isPlacementValid(tool, cellHasGrass)) return;
      setDecorations((prev) => ({ ...prev, [key]: tool }));
    },
    [grid, decorations, tool],
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
        editable={buildMode}
        tool={tool}
        onCellClick={onCellClick}
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
