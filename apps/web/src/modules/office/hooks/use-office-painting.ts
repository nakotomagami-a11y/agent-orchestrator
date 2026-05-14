"use client";

import { useCallback, useRef } from "react";
import { TILE } from "../components/office-map";
import type { BuildTool } from "../components/office-build-toolbar";
import { GRID_COLS, GRID_ROWS } from "./use-office-camera";

export function useOfficePainting({
  panRef,
  zoomRef,
}: {
  panRef: React.MutableRefObject<{ x: number; y: number }>;
  zoomRef: React.MutableRefObject<number>;
}) {
  const isPainting = useRef(false);
  const buildModeRef = useRef(false);
  const toolRef = useRef<BuildTool>("grass");
  const onCellClickRef = useRef<(x: number, y: number) => void>(() => undefined);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): boolean => {
      const isOnOverlay = !!(e.target as Element).closest(
        ".build-panel, .canvas-tools, .build-actions-bar, .canvas-info, .build-entry-btn",
      );
      if (
        e.button === 0 &&
        buildModeRef.current &&
        (toolRef.current === "grass" || toolRef.current === "erase") &&
        !isOnOverlay
      ) {
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
        return true;
      }
      return false;
    },
    [panRef, zoomRef],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): boolean => {
      if (!isPainting.current) return false;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const wx = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
      const wy = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
      const tx = Math.floor(wx / TILE);
      const ty = Math.floor(wy / TILE);
      if (tx >= 0 && tx < GRID_COLS && ty >= 0 && ty < GRID_ROWS) {
        onCellClickRef.current(tx, ty);
      }
      return true;
    },
    [panRef, zoomRef],
  );

  const onPointerUp = useCallback(() => {
    isPainting.current = false;
  }, []);

  return {
    buildModeRef,
    toolRef,
    onCellClickRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
