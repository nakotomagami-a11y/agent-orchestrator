// Reliable client-side map persistence. localStorage is synchronous and needs
// no server round-trip, so the map always survives a reload (the server
// ui_settings path was the source of "map doesn't persist" bugs). Reuses the
// existing parsers so kind-migration + grid resize-on-dimension-change apply.
import { parseGrid, parseDecorations, parseAgentPositions } from "./office-scene-data";
import { isGrassColor, type GrassColor } from "../components/grass-colors";
import type { DecorationsMap } from "../components/decorations";
import type { AgentPositions } from "../components/office-map";

const keyFor = (projectId: string | null) => `office-map:${projectId ?? "global"}`;

export type LocalMap = {
  grid: boolean[][] | null;
  decorations: DecorationsMap | null;
  grassColor: GrassColor | null;
  agentPositions: AgentPositions | null;
};

export function loadMapLocal(projectId: string | null): LocalMap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(projectId));
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      grid: o.grid !== undefined ? parseGrid(JSON.stringify(o.grid)) : null,
      decorations: o.decorations !== undefined ? parseDecorations(JSON.stringify(o.decorations)) : null,
      grassColor: typeof o.grassColor === "string" && isGrassColor(o.grassColor) ? o.grassColor : null,
      agentPositions: o.agentPositions !== undefined ? parseAgentPositions(JSON.stringify(o.agentPositions)) : null,
    };
  } catch {
    return null;
  }
}

export function saveMapLocal(
  projectId: string | null,
  map: { grid: boolean[][]; decorations: DecorationsMap; grassColor: GrassColor; agentPositions: AgentPositions },
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(projectId), JSON.stringify(map));
  } catch {
    /* quota exceeded / disabled — ignore */
  }
}
