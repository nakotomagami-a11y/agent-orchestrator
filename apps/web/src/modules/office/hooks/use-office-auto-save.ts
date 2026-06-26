import { useEffect } from "react";
import { patchUiSettings } from "@/lib/api/ui-settings";
import type { DecorationsMap } from "../components/decorations";
import type { AgentPositions } from "../components/office-map";
import type { GrassColor } from "../components/grass-colors";

export function useOfficeAutoSave(params: {
  sceneLoaded: boolean;
  useCustomMap: boolean;
  projectId: string | null;
  grid: boolean[][];
  decorations: DecorationsMap;
  agentPositions: AgentPositions;
  grassColor: GrassColor;
}): void {
  const { sceneLoaded, useCustomMap, projectId, grid, decorations, agentPositions, grassColor } = params;

  useEffect(() => {
    if (!sceneLoaded) return;
    const key = useCustomMap && projectId ? `office-grid:${projectId}` : "office-grid";
    const timer = setTimeout(() => {
      patchUiSettings({ [key]: JSON.stringify(grid) }).catch(() => { /* best-effort */ });
    }, 400);
    return () => clearTimeout(timer);
  }, [grid, sceneLoaded, useCustomMap, projectId]);

  useEffect(() => {
    if (!sceneLoaded) return;
    const key = useCustomMap && projectId ? `office-decorations:${projectId}` : "office-decorations";
    const timer = setTimeout(() => {
      patchUiSettings({ [key]: JSON.stringify(decorations) }).catch(() => { /* best-effort */ });
    }, 400);
    return () => clearTimeout(timer);
  }, [decorations, sceneLoaded, useCustomMap, projectId]);

  useEffect(() => {
    if (!sceneLoaded) return;
    const key = projectId ? `office-agents:${projectId}` : "office-agents";
    const timer = setTimeout(() => {
      patchUiSettings({ [key]: JSON.stringify(agentPositions) }).catch(() => { /* best-effort */ });
    }, 400);
    return () => clearTimeout(timer);
  }, [agentPositions, sceneLoaded, projectId]);

  useEffect(() => {
    if (!sceneLoaded) return;
    const key = useCustomMap && projectId ? `office-grass-color:${projectId}` : "office-grass-color";
    const timer = setTimeout(() => {
      patchUiSettings({ [key]: grassColor }).catch(() => { /* best-effort */ });
    }, 400);
    return () => clearTimeout(timer);
  }, [grassColor, sceneLoaded, useCustomMap, projectId]);
}
