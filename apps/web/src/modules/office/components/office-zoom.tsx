"use client";

import { useTranslations } from "next-intl";
import { useOfficeStore } from "../hooks/use-office-store";

export function OfficeZoom() {
  const t = useTranslations();
  const zoom = useOfficeStore((s) => s.zoom);
  const zoomIn = useOfficeStore((s) => s.zoomIn);
  const zoomOut = useOfficeStore((s) => s.zoomOut);
  const reset = useOfficeStore((s) => s.resetZoom);

  return (
    <div className="office-zoom" role="group" aria-label={t("office_toolbar.zoom_group_aria")}>
      <button type="button" onClick={zoomOut} aria-label={t("office_toolbar.zoom_out_aria")}>
        −
      </button>
      <div className="sep" />
      <button type="button" onClick={reset} aria-label={t("office_toolbar.zoom_reset_aria")} style={{ fontSize: 11 }}>
        {Math.round(zoom * 100)}%
      </button>
      <div className="sep" />
      <button type="button" onClick={zoomIn} aria-label={t("office_toolbar.zoom_in_aria")}>
        +
      </button>
    </div>
  );
}
