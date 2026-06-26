/**
 * React component wrapper for the pixel-planets WebGL renderer.
 *
 * Design decisions:
 *
 * Singleton renderer
 *   A module-level `PlanetRenderer` instance is shared by every `<PlanetCanvas>`
 *   on the page. This is intentional — WebGL contexts are expensive OS resources
 *   (browsers cap them at 8–16 per page). The singleton uses one context and
 *   renders all planets in a single rAF loop, copying each result to its
 *   display canvas with `drawImage`.
 *
 * No "use client" directive
 *   That directive is Next.js-specific. This component is framework-agnostic.
 *   If you're using Next.js (or another RSC framework), wrap this in your own
 *   thin client component:
 *
 *     "use client";
 *     export { PlanetCanvas } from "@agent-office/pixel-planets/react";
 *
 * Stable registration key
 *   The `key` string encodes every prop that affects the rendered output. When
 *   a prop changes, React re-runs the effect, we unregister the old key and
 *   register a new one. The renderer then re-computes params on the next frame.
 *   This is O(1) and avoids unnecessary re-renders.
 */
import { memo, useEffect, useRef } from "react";
import type { PlanetConfig } from "../types";
import { getPlanetParams } from "../params";
import { PlanetRenderer } from "../renderer/index";

// ---------------------------------------------------------------------------
// Module-level singleton — created lazily on first render
// ---------------------------------------------------------------------------

let globalRenderer: PlanetRenderer | null = null;

function getRenderer(): PlanetRenderer | null {
  if (typeof window === "undefined") return null;
  if (!globalRenderer) globalRenderer = new PlanetRenderer();
  return globalRenderer;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface PlanetCanvasProps {
  /**
   * Stable identifier for the owning entity (e.g. a project ID).
   * When `config` is absent, the renderer derives a deterministic random planet
   * from this ID so the planet looks the same on every render.
   */
  projectId: string;

  /**
   * Planet configuration. When omitted, a procedural planet is generated from
   * `projectId`. Changing any property triggers an immediate re-render.
   */
  config?: PlanetConfig;

  /**
   * Display size in CSS pixels. The canvas element is sized to this value;
   * the WebGL offscreen canvas may render at a higher resolution (for planet
   * types that need extra canvas space — star 2×, black hole 3×) and is then
   * downscaled via `drawImage`.
   *
   * @default 32
   */
  size?: number;

  /** Forwarded to the `<canvas>` element. */
  className?: string;
}

export const PlanetCanvas = memo(function PlanetCanvas({
  projectId,
  config,
  size = 32,
  className,
}: PlanetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = getRenderer();
    if (!canvas || !renderer) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const params = getPlanetParams(projectId, config);

    // Encode all appearance-affecting props into the key so changing any one
    // triggers unregister → register → fresh render.
    const key = config
      ? `${projectId}/${size}/${config.type}/${config.seed}/${config.paletteIdx}/${config.pixels ?? 0}/${config.rotation?.toFixed(3) ?? "r"}/${config.dither ?? 1}`
      : `${projectId}/${size}/auto`;

    renderer.register(key, { id: projectId, params, destCanvas: canvas, destCtx: ctx, size });
    return () => renderer.unregister(key);
  }, [projectId, config, size]);

  // imageRendering: pixelated prevents the browser from blurring the
  // pixel-art output when drawing to a canvas smaller than its CSS size.
  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "pixelated", display: "block" }}
    />
  );
});
