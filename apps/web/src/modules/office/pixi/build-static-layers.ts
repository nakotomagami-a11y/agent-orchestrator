import type { MutableRefObject } from "react";
import { AnimatedSprite, Application, Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";
import { CompositeTilemap } from "@pixi/tilemap";
import { TILE, buildTiles, buildFoam } from "../components/office-map";
import {
  DECORATIONS,
  type DecorationKind,
  type DecoInstance,
  type DecorationsMap,
} from "../components/decorations";
import { grassTilesetSrc, type GrassColor } from "../components/grass-colors";
import { BRIDGE_CAP_SRCS, FOAM_ANIM_SPEED, FOAM_FRAME, FOAM_FRAMES, FOAM_SHEET } from "./constants";
import { drawPathGraphics } from "./draw-path";

// Decoration animation speed: frames / duration / 60fps
function decoAnimSpeed(kind: DecorationKind): number {
  const def = DECORATIONS[kind];
  if (def.frames <= 1 || !def.animClass) return 0;
  const match = def.animClass.match(/([\d.]+)s/);
  const duration = match ? parseFloat(match[1]!) : 1.6;
  const fps = def.frames / duration;
  return fps / 60;
}

// Builds the terrain/foam/decoration/bridge-cap layers into `staticContainer`.
// Async because textures load on demand; `gen`/`genRef` let a superseded build
// bail after the await. `foamTickerRef` holds the single shared foam ticker.
export async function buildStaticLayers(
  staticContainer: Container,
  app: Application,
  foamTickerRef: MutableRefObject<((t: { deltaTime: number }) => void) | null>,
  grid: boolean[][],
  decorations: DecorationsMap,
  grassColor: GrassColor,
  gen: number,
  genRef: MutableRefObject<number>,
): Promise<void> {
  // Drop the previous foam ticker before rebuilding its sprites.
  if (foamTickerRef.current) {
    app.ticker.remove(foamTickerRef.current);
    foamTickerRef.current = null;
  }
  // Destroy previous sub-containers (stops AnimatedSprite ticker subscriptions
  // and releases texture wrapper references via destroy({ children: true }))
  for (const child of staticContainer.removeChildren()) {
    (child as Container).destroy({ children: true });
  }

  // ── Collect all asset URLs to load ─────────────────────────────────────────
  const tilesetUrl = grassTilesetSrc(grassColor);
  const urls = new Set<string>([tilesetUrl, FOAM_SHEET]);

  // Collect unique decoration URLs that are actually used
  const usedKinds = new Set<DecorationKind>();
  for (const stack of Object.values(decorations)) {
    for (const inst of stack) usedKinds.add(inst.kind);
  }
  for (const kind of usedKinds) {
    if (kind === "path") continue; // drawn via Graphics — no texture needed
    const d = DECORATIONS[kind];
    urls.add(d.src);
    if (d.rotFrames) for (const f of d.rotFrames) urls.add(f);
  }

  // Bridge cap URLs (preload if any bridges exist)
  const hasBridges = [...usedKinds].some(
    (k) => k === "bridge_h" || k === "bridge_v",
  );
  if (hasBridges) {
    for (const src of Object.values(BRIDGE_CAP_SRCS)) urls.add(src);
  }

  // Batch-load all textures.
  // Force nearest-neighbour filtering on every source: pixel-art sprites
  // look correct with nearest, and it prevents bilinear sampling from
  // bleeding into adjacent tiles in sprite-sheet crops (which is what
  // causes "house roof" fragments to appear at neighbouring positions in
  // WebKitGTK — Chromium hides this with sub-pixel blending).
  const textureMap = new Map<string, Texture>();
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const tex = await Assets.load<Texture>(url);
        tex.source.scaleMode = "nearest";
        textureMap.set(url, tex);
      } catch (err) {
        console.warn("[PixiJS] failed to load texture:", url, err);
      }
    }),
  );

  // ── Stale-call guard: bail if a newer build was triggered while we awaited ──
  if (gen !== genRef.current) return;

  // ── Create sub-containers ───────────────────────────────────────────────────
  // Terrain + foam render as batched tilemaps (≈one draw call each, no per-tile
  // scene nodes) so map size barely affects frame cost. Rare rotated grass caps
  // stay as Sprites; decorations/bridge caps remain sprites (sparse).
  const foamTilemap = new CompositeTilemap();
  const terrainTilemap = new CompositeTilemap();
  const rotatedTiles = new Container();
  const decoLayer = new Container();
  const capLayer = new Container();
  staticContainer.addChild(foamTilemap, terrainTilemap, rotatedTiles, decoLayer, capLayer);

  // ── Helper: create a cropped texture from a base texture ──────────────────
  function cropTexture(
    base: Texture,
    x: number,
    y: number,
    w: number,
    h: number,
  ): Texture {
    return new Texture({
      source: base.source,
      frame: new Rectangle(x, y, w, h),
    });
  }

  // ── Grass tiles ────────────────────────────────────────────────────────────
  const tilesetTex = textureMap.get(tilesetUrl);
  if (tilesetTex) {
    const QUARTER = TILE / 2; // 32
    const placed = buildTiles(grid);
    for (const t of placed) {
      if (t.quarter) {
        // Half-tile: 32×32 quadrant of the source tile
        const qx = t.quarter === "tr" || t.quarter === "br" ? QUARTER : 0;
        const qy = t.quarter === "bl" || t.quarter === "br" ? QUARTER : 0;
        const tex = cropTexture(
          tilesetTex,
          t.c * TILE + qx,
          t.r * TILE + qy,
          QUARTER,
          QUARTER,
        );
        terrainTilemap.tile(tex, t.x * TILE + qx, t.y * TILE + qy);
      } else if (t.rotate === 90) {
        // Rare 1-wide horizontal grass cap — keep as a rotated Sprite (the
        // tilemap batches only the unrotated tiles, which is ~all of them).
        const tex = cropTexture(tilesetTex, t.c * TILE, t.r * TILE, TILE, TILE);
        const sprite = new Sprite(tex);
        sprite.rotation = Math.PI / 2;
        // Pivot compensation: after 90° CW rotation, the left edge moves to the
        // bottom. Shift right by TILE so the sprite stays in its cell.
        sprite.x = t.x * TILE + TILE;
        sprite.y = t.y * TILE;
        rotatedTiles.addChild(sprite);
      } else {
        const tex = cropTexture(tilesetTex, t.c * TILE, t.r * TILE, TILE, TILE);
        terrainTilemap.tile(tex, t.x * TILE, t.y * TILE);
      }
    }
  }

  // ── Foam layer ─────────────────────────────────────────────────────────────
  const foamBaseTex = textureMap.get(FOAM_SHEET);
  if (foamBaseTex) {
    // Frame-0 crop; the tilemap animates every foam tile by stepping animX along
    // the sheet, so a single tileAnim update per tick drives them all.
    const foamFrame0 = cropTexture(foamBaseTex, 0, 0, FOAM_FRAME, FOAM_FRAME);
    const foamCells = buildFoam(grid);
    for (const { x, y } of foamCells) {
      // Same offset as CSS: x*TILE - TILE to centre the 3×3 foam frame on the cell
      foamTilemap.tile(foamFrame0, x * TILE - TILE, y * TILE - TILE, {
        animX: FOAM_FRAME,
        animCountX: FOAM_FRAMES,
      });
    }
    if (foamCells.length > 0) {
      let frame = 0;
      let acc = 0;
      const tick = (ticker: { deltaTime: number }) => {
        acc += FOAM_ANIM_SPEED * ticker.deltaTime;
        if (acc < 1) return;
        acc -= 1;
        frame = (frame + 1) % FOAM_FRAMES;
        // tileAnim defaults to null; assign a fresh array (the pipe reads it as
        // `parent.tileAnim || [0,0]`). Mutating null throws and halts the render
        // loop — which froze the whole canvas, camera included.
        foamTilemap.tileAnim = [frame, 0];
      };
      app.ticker.add(tick);
      foamTickerRef.current = tick;
    }
  }

  // ── Decorations ────────────────────────────────────────────────────────────
  // Sort by y (lower y first, higher rows render on top), then by layer
  const decoEntries: Array<{
    x: number;
    y: number;
    inst: DecoInstance;
    layer: number;
  }> = [];
  for (const [key, stack] of Object.entries(decorations)) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    for (let i = 0; i < stack.length; i++) {
      decoEntries.push({ x, y, inst: stack[i]!, layer: i });
    }
  }
  decoEntries.sort((a, b) => a.y - b.y || a.layer - b.layer);

  // Path neighbour helper used inside the decoration loop below.
  const hasPath = (cx: number, cy: number): boolean => {
    const stack = decorations[`${cx},${cy}`];
    return !!stack && stack.some((e) => e.kind === "path");
  };

  for (const { x, y, inst } of decoEntries) {
    const kind = inst.kind;
    // ── Path: draw with Graphics (no external PNG) ──────────────────────
    if (kind === "path") {
      const g = drawPathGraphics(
        hasPath(x, y - 1),
        hasPath(x + 1, y),
        hasPath(x, y + 1),
        hasPath(x - 1, y),
      );
      g.x = x * TILE;
      g.y = y * TILE;
      decoLayer.addChild(g);
      continue;
    }

    const def = DECORATIONS[kind];
    const srcForRot = def.rotFrames?.[inst.rot ?? 0] ?? def.src;
    const baseTex = textureMap.get(srcForRot);
    if (!baseTex) continue;

    // Per-instance pixel offset from the free-hand tool.
    const left = x * TILE + (TILE - def.frameW) / 2 + (inst.dx ?? 0);
    const top =
      (def.anchor === "center"
        ? y * TILE + (TILE - def.frameH) / 2
        : (y + 1) * TILE - def.frameH) + (inst.dy ?? 0);
    // Horizontal mirror: flip around the sprite's own centre.
    const applyFlip = (s: Sprite | AnimatedSprite) => {
      if (inst.flip) {
        s.scale.x = -1;
        s.x = left + def.frameW;
      } else {
        s.x = left;
      }
      s.y = top;
    };

    if (def.frames > 1 && def.animClass) {
      const frames: Texture[] = Array.from(
        { length: def.frames },
        (_, i) => cropTexture(baseTex, i * def.frameW, 0, def.frameW, def.frameH),
      );
      const anim = new AnimatedSprite(frames);
      applyFlip(anim);
      anim.animationSpeed = decoAnimSpeed(kind);
      anim.play();
      decoLayer.addChild(anim);
    } else {
      const tex = cropTexture(baseTex, 0, 0, def.frameW, def.frameH);
      const sprite = new Sprite(tex);
      applyFlip(sprite);
      decoLayer.addChild(sprite);
    }
  }

  // ── Bridge caps ────────────────────────────────────────────────────────────
  if (hasBridges) {
    const isLand = (cx: number, cy: number): boolean =>
      grid[cy]?.[cx] === true;
    for (const [key, stack] of Object.entries(decorations)) {
      const hasH = stack.some((e) => e.kind === "bridge_h");
      const hasV = stack.some((e) => e.kind === "bridge_v");
      if (!hasH && !hasV) continue;
      const [xs, ys] = key.split(",");
      const bx = Number(xs);
      const by = Number(ys);
      const capPairs: Array<{ x: number; y: number; src: string }> = [];
      if (hasH) {
        if (isLand(bx - 1, by))
          capPairs.push({ x: bx - 1, y: by, src: BRIDGE_CAP_SRCS.h_l });
        if (isLand(bx + 1, by))
          capPairs.push({ x: bx + 1, y: by, src: BRIDGE_CAP_SRCS.h_r });
      }
      if (hasV) {
        if (isLand(bx, by - 1))
          capPairs.push({ x: bx, y: by - 1, src: BRIDGE_CAP_SRCS.v_t });
        if (isLand(bx, by + 1))
          capPairs.push({ x: bx, y: by + 1, src: BRIDGE_CAP_SRCS.v_b });
      }
      for (const { x, y, src } of capPairs) {
        const capTex = textureMap.get(src);
        if (!capTex) continue;
        const sprite = new Sprite(capTex);
        sprite.x = x * TILE;
        sprite.y = y * TILE;
        capLayer.addChild(sprite);
      }
    }
  }
}
