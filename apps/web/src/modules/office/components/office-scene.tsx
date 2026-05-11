"use client";

import { useCallback, useEffect, useState } from "react";
import { OfficeMap } from "./office-map";
import { OfficeBuildToolbar, type BuildTool } from "./office-build-toolbar";

/**
 * Canvas for the new game-asset-based office view. Owns the editable
 * tile grid + the builder UI state.
 *
 * The grid is a fixed 16×10 cells (large enough for a comfortable island
 * with breathing room around it). Each cell is either grass-present or
 * empty; the auto-tile picker inside OfficeMap chooses the right
 * rim/interior tile for each grass cell. Builder mode swaps the map's
 * pointer-events on and overlays clickable cells; clicking flips a cell
 * to whatever the selected tool says.
 *
 * Grid persists to localStorage on every edit so the user's build
 * survives refreshes. The first session loads the seed island; subsequent
 * sessions load whatever the user last saved.
 */

const GRID_COLS = 16;
const GRID_ROWS = 10;
const STORAGE_KEY = "agent-office:office-grid:v1";

// Initial island shape from the previous static layout, centred in the
// new larger editable grid.
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
      const ch = row[x];
      grid[y + ISLAND_OFFSET_Y]![x + ISLAND_OFFSET_X] = ch === "X";
    }
  }
  return grid;
}

/**
 * Read the persisted grid from localStorage, falling back to the seed
 * island if nothing is stored or the stored shape doesn't match the
 * current grid dimensions (defensive against schema changes — e.g. if we
 * later widen the grid, an old saved state shouldn't crash the loader).
 */
function loadGrid(): boolean[][] {
  if (typeof window === "undefined") return makeSeedGrid();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
    /* fall through to seed */
  }
  return makeSeedGrid();
}

export function OfficeScene() {
  const [grid, setGrid] = useState<boolean[][]>(() => loadGrid());
  const [buildMode, setBuildMode] = useState(false);
  const [tool, setTool] = useState<BuildTool>("grass");

  // Write-through to localStorage whenever the grid changes. Skipped on
  // SSR (no window) and silently swallows quota errors — persistence is
  // best-effort, never the reason a click fails.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(grid));
    } catch {
      /* best-effort */
    }
  }, [grid]);

  const onCellClick = useCallback(
    (x: number, y: number) => {
      setGrid((prev) => {
        const next = prev.map((row) => [...row]);
        next[y]![x] = tool === "grass";
        return next;
      });
    },
    [tool],
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
      <OfficeMap grid={grid} editable={buildMode} onCellClick={onCellClick} />
      <OfficeBuildToolbar
        active={buildMode}
        tool={tool}
        onToggle={() => setBuildMode((m) => !m)}
        onSelectTool={setTool}
      />
    </div>
  );
}
