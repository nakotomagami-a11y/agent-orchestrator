"use client";

import { OfficeMap } from "./office-map";

/**
 * Canvas for the new game-asset-based office view. The backdrop is the
 * itch.zone scene image (cover-fitted); on top of it sits a hand-authored
 * two-tier grass island built from the Tiny Swords tileset. Decorations
 * (trees, bushes, water foam) and agent placement come in later passes.
 */
export function OfficeScene() {
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
        // Pixel art looks bad with the browser's default scaling filter.
        imageRendering: "pixelated",
        overflow: "hidden",
      }}
    >
      <OfficeMap />
    </div>
  );
}
