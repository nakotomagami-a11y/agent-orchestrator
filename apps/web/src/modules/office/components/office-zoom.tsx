"use client";

import { useOfficeStore } from "../hooks/use-office-store";

export function OfficeZoom() {
  const zoom = useOfficeStore((s) => s.zoom);
  const zoomIn = useOfficeStore((s) => s.zoomIn);
  const zoomOut = useOfficeStore((s) => s.zoomOut);
  const reset = useOfficeStore((s) => s.resetZoom);

  return (
    <div className="office-zoom" role="group" aria-label="Office zoom">
      <button type="button" onClick={zoomOut} aria-label="Zoom out">
        −
      </button>
      <div className="sep" />
      <button type="button" onClick={reset} aria-label="Reset zoom" style={{ fontSize: 11 }}>
        {Math.round(zoom * 100)}%
      </button>
      <div className="sep" />
      <button type="button" onClick={zoomIn} aria-label="Zoom in">
        +
      </button>
    </div>
  );
}
