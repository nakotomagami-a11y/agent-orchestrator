"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
  AnimatedSprite,
  Text,
  BlurFilter,
  ColorMatrixFilter,
} from "pixi.js";
import { TILE, buildTiles, buildFoam, type AgentPositions } from "./office-map";
import {
  DECORATIONS,
  type DecorationKind,
  type DecorationsMap,
} from "./decorations";
import { grassTilesetSrc, type GrassColor } from "./grass-colors";
import {
  UNIT_DEFS,
  unitSheetSrc,
  type UnitSheetState,
} from "@/components/ui/unit-sprite-registry";
import { getAgentActionAndFlip, isBridgeCell } from "../derive/agent-action";
import type { OfficeAgent } from "../hooks/use-office-agents";
import type { AgentInstance } from "@agent-office/domain/types";

const FOAM_SHEET = "/tiles/water-foam.png";
const FOAM_FRAME = TILE * 3; // 192px
const FOAM_FRAMES = 16;

// Animation speed in PixiJS "frames per ticker frame" (ticker runs at ~60fps)
// CSS: `1.6s steps(16)` = 10fps → 10/60
const FOAM_ANIM_SPEED = 10 / 60;

// Agent sprite constants
const AGENT_SIZE = 96;
const UNIT_ANIM_SPEED = 8 / 60; // 8 fps at ~60fps ticker

// Glow: a blurred silhouette recoloured via ColorMatrix (RGB from the offset
// column, alpha preserved), drawn behind the real sprite; BlurFilter spreads it
// into a halo. Amber = hover, red = search match.
const GLOW_AMBER: [number, number, number] = [251 / 255, 191 / 255, 36 / 255]; // #fbbf24
const GLOW_RED: [number, number, number] = [1, 0.14, 0.1]; // bright red
function setGlowColor(cm: ColorMatrixFilter, [r, g, b]: [number, number, number]): void {
  cm.matrix = [
    0, 0, 0, 0, r,
    0, 0, 0, 0, g,
    0, 0, 0, 0, b,
    0, 0, 0, 1, 0,
  ];
}
function makeGlow(): { cm: ColorMatrixFilter; filters: (ColorMatrixFilter | BlurFilter)[] } {
  const cm = new ColorMatrixFilter();
  setGlowColor(cm, GLOW_AMBER);
  // Low strength + tight quality keeps the halo hugging the silhouette so it
  // doesn't pool below the feet (which reads as the agent sinking downward).
  return { cm, filters: [cm, new BlurFilter({ strength: 3, quality: 2 })] };
}

// Container props stashed on each agent container so the glow ticker can toggle
// visibility/colour, keep the texture synced, and match against search.
type AgentContainerExtras = {
  __glow?: Sprite;
  __main?: AnimatedSprite;
  __cm?: ColorMatrixFilter;
  __name?: string;
};

// Path tiles are drawn with PixiJS Graphics (no PNG needed).
// Geometry constants — TILE=64, path band is 36px centred, 2px dark border.
const PATH_M = 14;          // margin: px from tile edge to path edge
const PATH_P = 36;          // path width in px  (TILE - 2*PATH_M = 36)
const PATH_B = 2;           // border width in px
const PATH_C_BORDER = 0x4A2E10; // dark rich brown outline
const PATH_C_FILL   = 0xB8884E; // warm earthy tan fill
const PATH_C_LIGHT  = 0xD0A86A; // lighter centre highlight

// Bridge cap auto-render sources
const BRIDGE_CAP_SRCS = {
  h_l: "/decorations/bridge-h-l.png",
  h_r: "/decorations/bridge-h-r.png",
  v_t: "/decorations/bridge-v-t.png",
  v_b: "/decorations/bridge-v-b.png",
} as const;

// Decoration animation speed: frames / duration / 60fps
function decoAnimSpeed(kind: DecorationKind): number {
  const def = DECORATIONS[kind];
  if (def.frames <= 1 || !def.animClass) return 0;
  const match = def.animClass.match(/([\d.]+)s/);
  const duration = match ? parseFloat(match[1]!) : 1.6;
  const fps = def.frames / duration;
  return fps / 60;
}

// ─── Agent helpers ─────────────────────────────────────────────────────────────

/** Resolve the action label to the sheet state string, falling back to "idle". */
function getSheetState(
  action: "idle" | "axe" | "pickaxe" | "knife" | "hammer",
  def: (typeof UNIT_DEFS)[keyof typeof UNIT_DEFS],
): UnitSheetState {
  if (action === "axe" && def.axe) return "axe";
  if (action === "hammer" && def.hammer) return "hammer";
  if (action === "pickaxe" && def.pickaxe) return "pickaxe";
  if (action === "knife" && def.knife) return "knife";
  return "idle";
}

interface Props {
  width: number;
  height: number;
  // Camera — controlled by parent (useOfficeCamera). Pixi applies these each
  // render; all pan/zoom interaction is handled by the outer React container.
  panX: number;
  panY: number;
  zoom: number;
  grid: boolean[][];
  decorations: DecorationsMap;
  grassColor: GrassColor;
  // Agent rendering
  agentPositions: AgentPositions;
  agentsById: Map<string, OfficeAgent>;
  agentSearch?: string;
  isMultiInstance?: boolean;
  rosterInstances?: AgentInstance[];
  spendByInstance?: Record<string, number>;
  // "x,y" of the hovered agent tile → glow that sprite. null = none.
  hoveredAgentKey?: string | null;
}

export function OfficePixiCanvas({
  width,
  height,
  panX,
  panY,
  zoom,
  grid,
  decorations,
  grassColor,
  agentPositions,
  agentsById,
  agentSearch,
  isMultiInstance,
  rosterInstances,
  spendByInstance,
  hoveredAgentKey,
}: Props) {
  // Container div — the canvas is created imperatively so each effect invocation
  // gets its own fresh HTMLCanvasElement (and thus its own WebGL context). React
  // StrictMode double-invokes effects; sharing a canvas between two Application
  // instances would cause loseContext() called by the first app's destroy() to
  // silently kill the second app's GL context before it ever renders.
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const staticContainerRef = useRef<Container | null>(null);
  const agentLayerRef = useRef<Container | null>(null);

  // Always-current camera props — written during render so async init callback
  // can read the latest values without stale closure over the mount-time props.
  const cameraPropsRef = useRef({ panX, panY, zoom });
  cameraPropsRef.current = { panX, panY, zoom };

  // Generation counters: incremented on each build call so a stale
  // async rebuild can detect it has been superseded and bail early.
  const buildGenRef = useRef(0);
  const agentBuildGenRef = useRef(0);

  // Always-current hovered agent key, read by the glow ticker without
  // re-subscribing on every hover change.
  const hoveredKeyRef = useRef<string | null | undefined>(hoveredAgentKey);
  hoveredKeyRef.current = hoveredAgentKey;

  // Always-current lowercased search query, read by the glow ticker.
  const searchRef = useRef("");
  searchRef.current = (agentSearch ?? "").toLowerCase().trim();

  // Signals that the PixiJS app is ready to receive scene data
  const [ready, setReady] = useState(false);

  // ─── Mount: init PixiJS ───────────────────────────────────────────────────
  useEffect(() => {
    const div = containerRef.current;
    if (!div) return;

    // Fresh canvas per effect invocation — prevents GL context sharing between
    // the two Application instances created by React StrictMode's double-invoke.
    const canvas = document.createElement("canvas");
    div.appendChild(canvas);

    const app = new Application();
    appRef.current = app;
    let alive = true;
    let initDone = false;

    // Round DPR to the nearest integer so the canvas is always at an exact
    // integer physical-to-CSS ratio.  Fractional DPR (e.g. 1.25 on Wayland)
    // combined with image-rendering:pixelated (inherited from the container)
    // causes nearest-neighbour downscaling artifacts — horizontal teal stripes
    // visible in WebKitGTK (Tauri) but hidden by Chromium's sub-pixel blending.
    const resolution = Math.round(window.devicePixelRatio ?? 1) || 1;

    app
      .init({
        canvas,
        width,
        height,
        backgroundAlpha: 0,
        antialias: false,
        resolution,
        autoDensity: true,
        // Snap all sprite screen positions to whole pixels so fractional zoom
        // values don't open 1px gaps between adjacent tiles (visible as teal
        // stripes on WebKitGTK which doesn't sub-pixel-blend like Chromium).
        roundPixels: true,
      })
      .then(() => {
        initDone = true;
        if (!alive) {
          // Cleanup ran before init resolved — destroy this app, remove its canvas.
          canvas.remove();
          app.destroy(false);
          return;
        }

        // autoDensity sets fixed pixel inline styles; replace with fluid sizing so
        // the canvas always fills its parent regardless of subsequent resizes.
        canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%";

        const world = new Container();
        app.stage.addChild(world);

        // Apply the current camera immediately so tiles are visible on first paint.
        // The camera sync effect already fired (with worldRef still null) by the
        // time this async callback resolves, so we must set position here.
        const cam = cameraPropsRef.current;
        const snappedZoom = Math.round(cam.zoom * TILE) / TILE;
        world.position.set(Math.round(cam.panX), Math.round(cam.panY));
        world.scale.set(snappedZoom);

        worldRef.current = world;

        const staticContainer = new Container();
        const agentLayer = new Container();
        world.addChild(staticContainer, agentLayer);
        staticContainerRef.current = staticContainer;
        agentLayerRef.current = agentLayer;

        setReady(true);
      })
      .catch((err: unknown) => {
        canvas.remove();
        console.error("[PixiJS] init failed:", err);
      });

    return () => {
      alive = false;
      if (initDone) {
        // Init already completed — safe to destroy immediately.
        canvas.remove();
        app.destroy(false);
      }
      // else: init still in-flight; the .then() handler above will clean up
      // once it resolves (alive=false check → canvas.remove + app.destroy).
      appRef.current = null;
      worldRef.current = null;
      staticContainerRef.current = null;
      agentLayerRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once only

  // ─── Resize ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const app = appRef.current;
    if (!app?.renderer) return;
    app.renderer.resize(width, height);
  }, [width, height]);

  // ─── Camera sync: apply pan/zoom from useOfficeCamera to the Pixi world ───
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    // Snap zoom so TILE × zoom is a whole number: every tile boundary lands on
    // an exact integer screen pixel regardless of the fractional pan offset.
    // Without this, 64 × 0.46 = 29.44 → tiles alternate 29/30px wide, opening
    // 1-pixel gaps that show the teal background as horizontal stripes in
    // WebKitGTK (which doesn't sub-pixel-blend like Chromium).
    const snappedZoom = Math.round(zoom * TILE) / TILE;
    world.position.set(Math.round(panX), Math.round(panY));
    world.scale.set(snappedZoom);
  }, [panX, panY, zoom]);

  // ─── Static layers build: runs whenever terrain/deco/grass data changes ──
  useEffect(() => {
    if (!ready) return;
    const sc = staticContainerRef.current;
    if (!sc) return;

    const gen = ++buildGenRef.current;
    buildStaticLayers(sc, grid, decorations, grassColor, gen, buildGenRef).catch(
      (err: unknown) => {
        console.error("[PixiJS] static layer build failed:", err);
      },
    );
  }, [ready, grid, decorations, grassColor]);

  // ─── Agent layer build: runs whenever agent data or terrain changes ────────
  useEffect(() => {
    if (!ready) return;
    const al = agentLayerRef.current;
    if (!al) return;

    const gen = ++agentBuildGenRef.current;
    buildAgentLayer(
      al,
      agentPositions,
      agentsById,
      grid,
      decorations,
      isMultiInstance ?? false,
      rosterInstances ?? [],
      spendByInstance ?? {},
      gen,
      agentBuildGenRef,
    ).catch((err: unknown) => {
      console.error("[PixiJS] agent layer build failed:", err);
    });
  }, [
    ready,
    agentPositions,
    agentsById,
    grid,
    decorations,
    isMultiInstance,
    rosterInstances,
    spendByInstance,
  ]);

  // ─── Hover glow: one persistent ticker toggles/syncs glows each frame ──────
  // Re-queries children every frame so it survives async agent rebuilds without
  // racing them. Cost is a short loop over agent containers per frame.
  useEffect(() => {
    if (!ready) return;
    const app = appRef.current;
    if (!app) return;
    const tick = () => {
      const al = agentLayerRef.current;
      if (!al) return;
      const key = hoveredKeyRef.current;
      const query = searchRef.current;
      for (const child of al.children) {
        const c = child as Container & AgentContainerExtras;
        if (!c.__glow || !c.__cm) continue;
        const hover = c.label === key;
        const match = query !== "" && (c.__name?.includes(query) ?? false);
        // Hover wins (amber); otherwise a search match glows red.
        if (hover) {
          setGlowColor(c.__cm, GLOW_AMBER);
          c.__glow.visible = true;
        } else if (match) {
          setGlowColor(c.__cm, GLOW_RED);
          c.__glow.visible = true;
        } else {
          c.__glow.visible = false;
        }
        if (c.__glow.visible && c.__main) c.__glow.texture = c.__main.texture;
        // Spotlight: dim non-matches while a query is active.
        c.alpha = query !== "" && !match && !hover ? 0.25 : 1;
      }
    };
    app.ticker.add(tick);
    return () => { app.ticker.remove(tick); };
  }, [ready]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
}

// ─── Path tile renderer ────────────────────────────────────────────────────────
// Draws one 64×64 path tile using PixiJS Graphics so we need no external PNG.
// n/e/s/w = whether that cardinal neighbour is also a path cell.
function drawPathGraphics(n: boolean, e: boolean, s: boolean, w: boolean): Graphics {
  const g = new Graphics();
  const M = PATH_M;
  const P = PATH_P;
  const B = PATH_B;

  // 1. Border (dark) — slightly expanded rects drawn first, fill on top reveals the ring
  g.rect(M - B, M - B, P + 2 * B, P + 2 * B);
  if (n) g.rect(M - B, 0,         P + 2 * B, M + B);
  if (s) g.rect(M - B, M + P - B, P + 2 * B, M + B);
  if (e) g.rect(M + P - B, M - B, M + B,     P + 2 * B);
  if (w) g.rect(0,         M - B, M + B,     P + 2 * B);
  g.fill({ color: PATH_C_BORDER });

  // 2. Main fill (earthy tan)
  g.rect(M, M, P, P);
  if (n) g.rect(M, 0,     P, M);
  if (s) g.rect(M, M + P, P, M);
  if (e) g.rect(M + P, M, M, P);
  if (w) g.rect(0, M,     M, P);
  g.fill({ color: PATH_C_FILL });

  // 3. Centre highlight strip — lighter 12px band along the middle of the path band
  const HL = 12;
  const HO = M + (P - HL) / 2; // offset from tile edge to highlight start
  g.rect(HO, HO, HL, HL);
  if (n) g.rect(HO, B,        HL, HO - B);
  if (s) g.rect(HO, M + P,    HL, M - B);
  if (e) g.rect(M + P, HO,    M - B, HL);
  if (w) g.rect(B,     HO,    HO - B, HL);
  g.fill({ color: PATH_C_LIGHT });

  return g;
}

// ─── Static layer builder (renamed from buildPixiScene) ────────────────────────
async function buildStaticLayers(
  staticContainer: Container,
  grid: boolean[][],
  decorations: DecorationsMap,
  grassColor: GrassColor,
  gen: number,
  genRef: MutableRefObject<number>,
): Promise<void> {
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
    for (const kind of stack) usedKinds.add(kind);
  }
  for (const kind of usedKinds) {
    if (kind === "path") continue; // drawn via Graphics — no texture needed
    urls.add(DECORATIONS[kind].src);
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
  const foamLayer = new Container();
  const tileLayer = new Container();
  const decoLayer = new Container();
  const capLayer = new Container();
  staticContainer.addChild(foamLayer, tileLayer, decoLayer, capLayer);

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
        const sprite = new Sprite(tex);
        sprite.x = t.x * TILE + qx;
        sprite.y = t.y * TILE + qy;
        tileLayer.addChild(sprite);
      } else {
        const tex = cropTexture(tilesetTex, t.c * TILE, t.r * TILE, TILE, TILE);
        const sprite = new Sprite(tex);
        sprite.x = t.x * TILE;
        sprite.y = t.y * TILE;
        if (t.rotate === 90) {
          sprite.rotation = Math.PI / 2;
          // Pivot compensation: after 90° CW rotation, the left edge moves to
          // the bottom. Shift right by TILE so the sprite stays in its cell.
          sprite.x += TILE;
        }
        tileLayer.addChild(sprite);
      }
    }
  }

  // ── Foam layer ─────────────────────────────────────────────────────────────
  const foamBaseTex = textureMap.get(FOAM_SHEET);
  if (foamBaseTex) {
    // Pre-build the 16 frame textures (shared across all foam sprites)
    const foamFrames: Texture[] = Array.from({ length: FOAM_FRAMES }, (_, i) =>
      cropTexture(foamBaseTex, i * FOAM_FRAME, 0, FOAM_FRAME, FOAM_FRAME),
    );

    const foamCells = buildFoam(grid);
    for (const { x, y } of foamCells) {
      const anim = new AnimatedSprite(foamFrames);
      // Same offset as CSS: x*TILE - TILE to centre the 3×3 foam frame on the cell
      anim.x = x * TILE - TILE;
      anim.y = y * TILE - TILE;
      anim.animationSpeed = FOAM_ANIM_SPEED;
      anim.play();
      foamLayer.addChild(anim);
    }
  }

  // ── Decorations ────────────────────────────────────────────────────────────
  // Sort by y (lower y first, higher rows render on top), then by layer
  const decoEntries: Array<{
    x: number;
    y: number;
    kind: DecorationKind;
    layer: number;
  }> = [];
  for (const [key, stack] of Object.entries(decorations)) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    for (let i = 0; i < stack.length; i++) {
      decoEntries.push({ x, y, kind: stack[i]!, layer: i });
    }
  }
  decoEntries.sort((a, b) => a.y - b.y || a.layer - b.layer);

  // Path neighbour helper used inside the decoration loop below.
  const hasPath = (cx: number, cy: number): boolean => {
    const stack = decorations[`${cx},${cy}`];
    return !!stack && stack.includes("path");
  };

  for (const { x, y, kind } of decoEntries) {
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
    const baseTex = textureMap.get(def.src);
    if (!baseTex) continue;

    const left = x * TILE + (TILE - def.frameW) / 2;
    const top =
      def.anchor === "center"
        ? y * TILE + (TILE - def.frameH) / 2
        : (y + 1) * TILE - def.frameH;

    if (def.frames > 1 && def.animClass) {
      const frames: Texture[] = Array.from(
        { length: def.frames },
        (_, i) => cropTexture(baseTex, i * def.frameW, 0, def.frameW, def.frameH),
      );
      const anim = new AnimatedSprite(frames);
      anim.x = left;
      anim.y = top;
      anim.animationSpeed = decoAnimSpeed(kind);
      anim.play();
      decoLayer.addChild(anim);
    } else {
      const tex = cropTexture(baseTex, 0, 0, def.frameW, def.frameH);
      const sprite = new Sprite(tex);
      sprite.x = left;
      sprite.y = top;
      decoLayer.addChild(sprite);
    }
  }

  // ── Bridge caps ────────────────────────────────────────────────────────────
  if (hasBridges) {
    const isLand = (cx: number, cy: number): boolean =>
      grid[cy]?.[cx] === true;
    for (const [key, stack] of Object.entries(decorations)) {
      const hasH = stack.includes("bridge_h");
      const hasV = stack.includes("bridge_v");
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

// ─── Agent layer builder ───────────────────────────────────────────────────────
async function buildAgentLayer(
  agentLayer: Container,
  agentPositions: AgentPositions,
  agentsById: Map<string, OfficeAgent>,
  grid: boolean[][],
  decorations: DecorationsMap,
  isMultiInstance: boolean,
  rosterInstances: AgentInstance[],
  spendByInstance: Record<string, number>,
  gen: number,
  genRef: MutableRefObject<number>,
): Promise<void> {
  // Destroy previous agent containers
  for (const child of agentLayer.removeChildren()) {
    (child as Container).destroy({ children: true });
  }

  // ── Pre-compute instance index map (mirrors office-map.tsx logic) ──────────
  const instanceIndexMap = new Map<string, number>();
  if (isMultiInstance && rosterInstances.length > 0) {
    const seenByAgent = new Map<string, number>();
    for (const inst of rosterInstances) {
      const prev = seenByAgent.get(inst.agentId) ?? 0;
      const idx = prev + 1;
      seenByAgent.set(inst.agentId, idx);
      instanceIndexMap.set(inst.instanceId, idx);
    }
  }

  // ── Collect all needed unit sheet URLs ─────────────────────────────────────
  const neededUrls = new Set<string>();
  for (const [key, ref] of Object.entries(agentPositions)) {
    const agent = agentsById.get(ref.agentId);
    if (!agent) continue;
    const { faction, kind } = agent.unitChoice;
    const def = UNIT_DEFS[kind];
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    const isWorking = agent.status === "working" || agent.status === "thinking";
    const { action } = getAgentActionAndFlip(x, y, isWorking, kind, decorations);
    const state = getSheetState(action, def);
    neededUrls.add(unitSheetSrc(faction, kind, state));
    neededUrls.add(unitSheetSrc(faction, kind, "idle"));
    // Pawn action sheets only exist for the black faction; preload them so
    // non-black pawns can fall back to them during working animations.
    if (kind === "pawn" && state !== "idle") {
      neededUrls.add(unitSheetSrc("black", "pawn", state));
    }
  }

  await Promise.all(
    [...neededUrls].map((url) =>
      Assets.load<Texture>(url)
        .then((tex) => { tex.source.scaleMode = "nearest"; })
        .catch(() => { /* silently skip missing sheets */ }),
    ),
  );

  // Stale-call guard
  if (gen !== genRef.current) return;

  // ── Sort agents by y so lower rows draw on top ─────────────────────────────
  const sortedEntries = Object.entries(agentPositions)
    .map(([key, ref]) => {
      const [xs, ys] = key.split(",");
      return { x: Number(xs), y: Number(ys), ref };
    })
    .sort((a, b) => a.y - b.y);

  // Feet Y target: world pixels below a tile's top edge where all units'
  // ground contact should land. Sits 10% of a tile above the cell's bottom
  // edge (the decoration ground line) so agents read as standing on the tile.
  const TARGET_FEET_Y = TILE * 0.9;

  // ── Build a Container per agent ────────────────────────────────────────────
  for (const { x, y, ref } of sortedEntries) {
    const agent = agentsById.get(ref.agentId);
    if (!agent) continue;

    const { faction, kind } = agent.unitChoice;
    const def = UNIT_DEFS[kind];
    const isWorking = agent.status === "working" || agent.status === "thinking";
    const { action, flip } = getAgentActionAndFlip(x, y, isWorking, kind, decorations);
    const state = getSheetState(action, def);

    // Resolve texture. For pawn action sheets that only exist for black faction,
    // fall back to black/pawn/<state> before giving up and using idle.
    let sheetUrl = unitSheetSrc(faction, kind, state);
    let sheetTex: Texture | null = Assets.get<Texture>(sheetUrl) ?? null;
    if (!sheetTex && state !== "idle" && kind === "pawn") {
      sheetUrl = unitSheetSrc("black", "pawn", state);
      sheetTex = Assets.get<Texture>(sheetUrl) ?? null;
    }
    if (!sheetTex && state !== "idle") {
      sheetUrl = unitSheetSrc(faction, kind, "idle");
      sheetTex = Assets.get<Texture>(sheetUrl) ?? null;
    }
    if (!sheetTex) continue;

    // Determine which frame count to use (getSheetState never returns "run")
    const frameCount =
      state === "idle"    ? def.idle.frames
      : state === "axe"     ? (def.axe?.frames    ?? def.idle.frames)
      : state === "hammer"  ? (def.hammer?.frames  ?? def.idle.frames)
      : state === "pickaxe" ? (def.pickaxe?.frames ?? def.idle.frames)
      : state === "knife"   ? (def.knife?.frames   ?? def.idle.frames)
      : def.idle.frames;

    // Slice the horizontal strip into individual frame textures
    const frameTextures: Texture[] = Array.from({ length: frameCount }, (_, i) =>
      new Texture({
        source: sheetTex!.source,
        frame: new Rectangle(i * def.frameW, 0, def.frameW, def.frameH),
      }),
    );

    // Per-unit canvas size: lancers have a tall bbox due to the spear so
    // we scale up their container to match visual weight with other units.
    const agentSize = Math.round(AGENT_SIZE * (def.sizeMultiplier ?? 1));

    // ── Sprite math: scale bbox to agentSize ───────────────────────────────
    const spriteScale = agentSize / Math.max(def.bbox.w, def.bbox.h);
    const padX = (agentSize - def.bbox.w * spriteScale) / 2;
    const padY = (agentSize - def.bbox.h * spriteScale) / 2;
    const spriteX = padX - def.bbox.x * spriteScale;
    const spriteY = padY - def.bbox.y * spriteScale;
    // Mirror: when flipping (scale.x = -spriteScale), the pixel at frame-coord fx
    // renders at: container_x = spriteX' + fx * (-spriteScale)
    // To match CSS scaleX(-1) around the agentSize-wide box:
    //   container_x_flipped = agentSize - (spriteX + fx * spriteScale)
    // → spriteX'(flip) = agentSize - spriteX
    const spriteXFlip = agentSize - spriteX;

    // ── Agent position on tile ─────────────────────────────────────────────
    // groundY: native-frame Y of the feet contact point.
    // Falls back to bbox.y + bbox.h for units that don't need it.
    // Lancer: actual boot contact at y=185 (pixel-verified); lance tip
    // swings through the rest of the bbox and must not drive the anchor.
    const groundNativeY = def.groundY ?? (def.bbox.y + def.bbox.h);
    const feetInContainer = spriteY + groundNativeY * spriteScale;

    const onBridge = isBridgeCell(x, y, grid, decorations);
    const agentLeft = x * TILE + (TILE - agentSize) / 2;
    const agentTop =
      y * TILE + TARGET_FEET_Y - feetInContainer - (onBridge ? Math.round(TILE * 0.35) : 0);

    // Container at the tile position; AnimatedSprite inside with the offset
    const agentContainer = new Container();
    agentContainer.x = agentLeft;
    agentContainer.y = agentTop;

    const animSprite = new AnimatedSprite(frameTextures);
    animSprite.scale.set(flip ? -spriteScale : spriteScale, spriteScale);
    animSprite.x = flip ? spriteXFlip : spriteX;
    animSprite.y = spriteY;
    animSprite.animationSpeed = UNIT_ANIM_SPEED;
    animSprite.play();

    // Hover glow: recoloured, blurred silhouette behind the sprite (hidden until
    // hovered). Shares the main sprite's transform; texture is synced to the
    // current animation frame by the hover effect while active.
    const glow = new Sprite(frameTextures[animSprite.currentFrame] ?? frameTextures[0]);
    glow.scale.set(flip ? -spriteScale : spriteScale, spriteScale);
    glow.x = flip ? spriteXFlip : spriteX;
    glow.y = spriteY;
    const glowFx = makeGlow();
    glow.filters = glowFx.filters;
    glow.visible = false;
    agentContainer.addChild(glow);
    agentContainer.addChild(animSprite);
    agentContainer.label = `${x},${y}`;
    const extras = agentContainer as Container & AgentContainerExtras;
    extras.__glow = glow;
    extras.__main = animSprite;
    extras.__cm = glowFx.cm;
    extras.__name = agent.name.toLowerCase();

    // ── Instance badge & spend pill ────────────────────────────────────────
    const instanceIdx = ref.instanceId
      ? instanceIndexMap.get(ref.instanceId)
      : undefined;
    const showBadge = isMultiInstance && instanceIdx !== undefined && instanceIdx > 1;
    if (showBadge) {
      const badge = new Text({
        text: `#${instanceIdx}`,
        style: {
          fill: 0xf4efe8,
          fontSize: 9,
          fontFamily: "monospace",
          fontWeight: "600",
        },
      });
      // anchor(1,1) = bottom-right corner of the text is positioned at (x,y)
      // so we don't need the pre-render width/height (which would be 0 before
      // the first render pass in PixiJS v8's lazy-render model)
      badge.anchor.set(1, 1);
      badge.x = agentSize - 2;
      badge.y = agentSize - 2;
      agentContainer.addChild(badge);
    }

    const spendKey = ref.instanceId ? `${ref.agentId}|${ref.instanceId}` : null;
    const instSpend = spendKey ? (spendByInstance[spendKey] ?? 0) : 0;
    if (isMultiInstance && instSpend > 0) {
      const pill = new Text({
        text: `$${instSpend.toFixed(2)}`,
        style: {
          fill: 0x88cc88,
          fontSize: 9,
          fontFamily: "monospace",
          fontWeight: "600",
        },
      });
      pill.anchor.set(1, 1);
      pill.x = agentSize - 2;
      pill.y = showBadge ? agentSize - 14 : agentSize - 2;
      agentContainer.addChild(pill);
    }

    // Search highlight (dim non-matches + red glow) is applied per frame by the
    // glow ticker via __name, so it doesn't rebuild the scene on each keystroke.

    agentLayer.addChild(agentContainer);
  }
}
