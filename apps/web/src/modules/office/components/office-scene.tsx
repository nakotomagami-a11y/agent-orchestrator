"use client";

/**
 * Blank canvas for the new game-asset-based office view. Renders nothing
 * yet beyond a backdrop — tile renderer, decorations, and agent placement
 * land on top in subsequent iterations.
 *
 * Replaces (does not delete) the legacy IsoOffice — that component and its
 * SVG floor/walls/chairs/plants stay on disk under iso-office/ for reuse
 * or removal once the new view stabilises.
 */
export function OfficeScene() {
  return (
    <div
      className="office-scene"
      style={{
        width: "100%",
        height: "100%",
        backgroundImage:
          "url('https://img.itch.zone/aW1nLzEwNDk2NzQ4LnBuZw==/original/eqMZWi.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        // Pixel art looks bad with the browser's default scaling filter.
        imageRendering: "pixelated",
      }}
    />
  );
}
