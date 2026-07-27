/**
 * React wrapper for the pixel-icons generator.
 *
 * Icons are static (no animation), so this just draws once into a canvas on
 * mount and whenever the config or size changes. The internal canvas is sized
 * to `dimension` native pixels (default 48) and scaled up to `size` CSS pixels
 * with `image-rendering: pixelated` for crisp pixel art.
 *
 * No "use client" directive — this component is framework-agnostic. Under
 * Next.js (RSC), re-export it from a thin client module:
 *
 *     "use client";
 *     export { WeaponIcon } from "@agent-office/pixel-icons/react";
 */
import { memo, useEffect, useRef } from "react";
import type { IconConfig } from "../types";
import { IconGenerator } from "../generator";

export interface WeaponIconProps {
  /** Icon configuration (seed + class). Same config → same icon everywhere. */
  config: IconConfig;
  /** Display size in CSS pixels. @default 48 */
  size?: number;
  /**
   * Native render resolution in pixels. Higher = finer pixels / smaller blocks
   * when the icon is scaled up. Omit to auto-supersample from `size` (≈0.7× the
   * display size, clamped to 48–96) — the generator's composition is now
   * scale-invariant, so higher resolutions just refine the pixels. Pass an
   * explicit value to override (32 for chunky retro blocks).
   */
  dimension?: number;
  /**
   * Outline color [r, g, b] 0–255. Omit for the original pure black; a dark
   * desaturated tone (e.g. [26, 22, 34]) reads softer against dark UIs.
   */
  border?: [number, number, number];
  /** Forwarded to the canvas element. */
  className?: string;
}

export const WeaponIcon = memo(function WeaponIcon({
  config,
  size = 48,
  dimension,
  border,
  className,
}: WeaponIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Auto-supersample: render finer than the display size so the pixels read
  // small and smooth, clamped to 48–96. The generator's proportions are
  // scale-invariant, so this only refines detail — it never reshapes the icon.
  const nativeDim = dimension ?? Math.min(96, Math.max(48, Math.round(size * 0.7)));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, nativeDim, nativeDim);
    new IconGenerator(ctx, nativeDim, { border }).generate(config);
  }, [config, nativeDim, border]);

  return (
    <canvas
      ref={canvasRef}
      width={nativeDim}
      height={nativeDim}
      className={className}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        display: "block",
        flexShrink: 0,
      }}
    />
  );
});
