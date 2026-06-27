"use client";

import { useEffect, useRef } from "react";

// ─── Tunables ────────────────────────────────────────────────────────────────

// Offscreen tile dimensions (canvas pixels).
// Small on purpose — the browser tiles it across the full canvas via CanvasPattern,
// so rendering cost is O(T²) not O(screen²).
const T = 128;

// Voronoi cells per tile axis → each cell ≈ T/N = 18 canvas px = 36 screen px.
const N = 7;

// Screen pixels per canvas pixel (CSS upscale via imageRendering: pixelated).
const CELL = 2;

// Drift animation speed.
const SPEED = 0.25;

// Voronoi edge width in cell-space.
const EDGE_W = 0.13;

// Tile re-render interval (ms). 12 fps is plenty for water drift.
const TILE_MS = 1000 / 12;

// Maximum opacity at full zoom; fades toward MIN_OPACITY as you zoom out.
const CANVAS_OPACITY = 0.55;
const MIN_OPACITY    = 0.08;

// Zoom level below which pattern scale is clamped (prevents cells becoming
// microscopic / noisy at extreme zoom-out).
const Z_CLAMP = 0.5;

// Zoom level at which opacity reaches CANVAS_OPACITY; fades linearly to
// MIN_OPACITY below this.
const Z_FADE = 0.7;

// ─── Palette ─────────────────────────────────────────────────────────────────

const C_DEEP:   [number,number,number] = [0x1e, 0x62, 0x60];
const C_FILL:   [number,number,number] = [0x33, 0x96, 0x93];
const C_BRIGHT: [number,number,number] = [0x68, 0xcc, 0xc9];
const C_WHITE:  [number,number,number] = [0xb8, 0xe8, 0xe6];

// ─── Module-level precomputed cell constants ──────────────────────────────────
// Computed once at module load: hash values and trig argument coefficients for
// each of the N×N voronoi cells.  No Math.sin in the hot pixel loop.

function fract(x: number) { return x - Math.floor(x); }

const FREQ_X = new Float32Array(N * N);
const FREQ_Y = new Float32Array(N * N);
const AMP_X  = new Float32Array(N * N);
const AMP_Y  = new Float32Array(N * N);

for (let iy = 0; iy < N; iy++) {
  for (let ix = 0; ix < N; ix++) {
    const k  = iy * N + ix;
    const hx = fract(Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453);
    const hy = fract(Math.sin(ix * 269.5  + iy * 183.3) * 43758.5453);
    FREQ_X[k] = 6.283 * hx;
    FREQ_Y[k] = 6.283 * hy;
    AMP_X[k]  = 0.5 + hx * 0.4;
    AMP_Y[k]  = 0.4 + hy * 0.5;
  }
}

// Reusable animated position buffers — filled each tile frame.
const OX = new Float32Array(N * N);
const OY = new Float32Array(N * N);

function updatePositions(t: number) {
  for (let k = 0; k < N * N; k++) {
    OX[k] = 0.5 + 0.42 * Math.sin(FREQ_X[k] + t * AMP_X[k]);
    OY[k] = 0.5 + 0.42 * Math.sin(FREQ_Y[k] + t * AMP_Y[k]);
  }
}

// ─── Tile renderer ───────────────────────────────────────────────────────────
// Renders N×N toroidally-tiling voronoi into a T×T ImageData.
// Toroidal neighbour lookup ensures seam-free CSS background tiling.

function lerp3(
  a: [number,number,number],
  b: [number,number,number],
  t: number,
): [number,number,number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function renderTile(tileCtx: CanvasRenderingContext2D, img: ImageData, t: number) {
  updatePositions(t);
  const data = img.data;

  for (let cy = 0; cy < T; cy++) {
    const v  = cy * N / T;
    const gy = Math.floor(v);
    const fv = v - gy;

    for (let cx = 0; cx < T; cx++) {
      const u  = cx * N / T;
      const gx = Math.floor(u);
      const fu = u - gx;

      let d1sq = 9e9;
      let d2sq = 9e9;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx  = ((gx + dx) % N + N) % N;
          const ny  = ((gy + dy) % N + N) % N;
          const k   = ny * N + nx;
          const rx  = dx + OX[k] - fu;
          const ry  = dy + OY[k] - fv;
          const dsq = rx * rx + ry * ry;
          if      (dsq < d1sq) { d2sq = d1sq; d1sq = dsq; }
          else if (dsq < d2sq) { d2sq = dsq; }
        }
      }

      const d1   = Math.sqrt(d1sq);
      const d2   = Math.sqrt(d2sq);
      const edge = d2 - d1;

      const c = edge < EDGE_W
        ? lerp3(C_WHITE, C_BRIGHT, (edge / EDGE_W) ** 2)
        : lerp3(C_FILL,  C_DEEP,   Math.min(1, (d1 - 0.04) * 2.0) * 0.5);

      const i    = (cy * T + cx) * 4;
      data[i]    = c[0];
      data[i+1]  = c[1];
      data[i+2]  = c[2];
      data[i+3]  = 255;
    }
  }

  tileCtx.putImageData(img, 0, 0);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface WaterShaderCanvasProps {
  active: boolean;
  /** Refs from useOfficeCamera — read every frame without causing re-renders. */
  zoomRef: { current: number };
  panRef:  { current: { x: number; y: number } };
}

export function WaterShaderCanvas({ active, zoomRef, panRef }: WaterShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) return;

    // Small offscreen tile — re-rendered at TILE_FPS.
    const tile    = document.createElement("canvas");
    tile.width    = T;
    tile.height   = T;
    const tileCtx = tile.getContext("2d")!;
    const tileImg = tileCtx.createImageData(T, T);

    let pattern:  CanvasPattern | null = null;
    let lastTile  = -Infinity;
    let alive     = true;

    const resize = () => {
      const w = Math.max(1, Math.ceil(canvas.offsetWidth  / CELL));
      const h = Math.max(1, Math.ceil(canvas.offsetHeight / CELL));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
        pattern = null; // will be recreated next frame
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const frame = (ts: number) => {
      if (!alive) return;

      const t = ts * 0.001 * SPEED;

      // Re-render tile at low fps — only T² pixels, no trig in hot loop.
      if (ts - lastTile > TILE_MS) {
        renderTile(tileCtx, tileImg, t);
        pattern  = ctx.createPattern(tile, "repeat");
        lastTile = ts;
      }

      // Each frame: fill entire canvas with the tiled pattern, scaled and
      // offset to match camera zoom + pan.  One fillRect — browser-composited.
      if (pattern) {
        const z = zoomRef.current;

        // Scale the tile with zoom; clamp so cells never get microscopic.
        const effectiveZ = Math.max(z, Z_CLAMP);
        const scale      = 1 / effectiveZ;

        // Pan in canvas-pixel space, normalised by effectiveZ so the grid
        // stays anchored to the world as you scroll.
        // M = Scale(scale) · Translate(-panX/CELL, -panY/CELL)
        // → canvas pt (cx,cy) samples pattern at (cx − panX/CELL) · scale
        const tx = -panRef.current.x / CELL;
        const ty = -panRef.current.y / CELL;
        pattern.setTransform(new DOMMatrix().scaleSelf(scale).translateSelf(tx, ty));

        // Opacity: full at Z_FADE and above, fades linearly to MIN_OPACITY below.
        const opacity = MIN_OPACITY + (CANVAS_OPACITY - MIN_OPACITY) * Math.min(1, z / Z_FADE);
        canvas.style.opacity = opacity.toFixed(3);

        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [active, zoomRef, panRef]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
