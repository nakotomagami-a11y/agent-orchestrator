"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  Application,
  Assets,
  Container,
  Rectangle,
  Sprite,
  Texture,
  AnimatedSprite,
  Text,
} from "pixi.js";
import { TILE, buildTiles, buildFoam, type AgentPositions } from "./office-map";
import {
  DECORATIONS,
  type DecorationKind,
  type DecorationsMap,
  decorationKey,
  familyOf,
} from "./decorations";
import { grassTilesetSrc, type GrassColor } from "./grass-colors";
import {
  UNIT_DEFS,
  unitSheetSrc,
  type UnitSheetState,
} from "@/components/ui/unit-sprite.utils";
import type { OfficeAgent } from "../hooks/use-office-agents";
import type { AgentInstance } from "@agent-office/shared/types";

// ─── Constants (mirror office-map.tsx) ────────────────────────────────────────
const GRID_COLS = 40;
const GRID_ROWS = 26;

const FOAM_SHEET = "/tiles/water-foam.png";
const FOAM_FRAME = TILE * 3; // 192px
const FOAM_FRAMES = 16;

// Animation speed in PixiJS "frames per ticker frame" (ticker runs at ~60fps)
// CSS: `1.6s steps(16)` = 10fps → 10/60
const FOAM_ANIM_SPEED = 10 / 60;

// Agent sprite constants
const AGENT_SIZE = 96;
const UNIT_ANIM_SPEED = 8 / 60; // 8 fps at ~60fps ticker

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

/**
 * Resolve the action label to the sheet state string, falling back to "idle"
 * when a unit doesn't have the requested action sheet.
 */
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

/**
 * Determine the action and flip flag for an agent, replicating office-map.tsx.
 * `isWorking` means status is "working" or "thinking".
 */
function getAgentActionAndFlip(
  x: number,
  y: number,
  isWorking: boolean,
  decorations: DecorationsMap,
): { action: "idle" | "axe" | "pickaxe" | "knife" | "hammer"; flip: boolean } {
  if (!isWorking) return { action: "idle", flip: false };
  const has = (nx: number, ny: number, f: string): boolean => {
    const stack = decorations[decorationKey(nx, ny)];
    return !!stack && stack.some((k) => familyOf(k) === f);
  };
  const hasTree =
    has(x, y, "tree") || has(x, y + 1, "tree") || has(x, y + 2, "tree");
  const sheepRight = has(x + 1, y, "sheep");
  const sheepLeft = has(x - 1, y, "sheep");
  if (hasTree) return { action: "axe", flip: false };
  if (has(x, y, "rock")) return { action: "pickaxe", flip: false };
  if (sheepRight || sheepLeft)
    return { action: "knife", flip: !sheepRight && sheepLeft };
  return { action: "hammer", flip: false };
}

/**
 * Whether the cell is a bridge water cell (agent sits above the tile).
 * Mirrors isBridgeCell in office-map.tsx.
 */
function isBridgeCell(
  x: number,
  y: number,
  grid: boolean[][],
  decorations: DecorationsMap,
): boolean {
  if (grid[y]?.[x] === true) return false;
  const stack = decorations[decorationKey(x, y)];
  return !!stack && stack.some((k) => familyOf(k) === "bridge");
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

    app
      .init({
        canvas,
        width,
        height,
        backgroundAlpha: 0,
        antialias: false,
        resolution: window.devicePixelRatio ?? 1,
        autoDensity: true,
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
        world.position.set(cam.panX, cam.panY);
        world.scale.set(cam.zoom);

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
    world.position.set(panX, panY);
    world.scale.set(zoom);
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
      agentSearch ?? "",
      isMultiInstance ?? false,
      rosterInstances ?? [],
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
    agentSearch,
    isMultiInstance,
    rosterInstances,
  ]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
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
    urls.add(DECORATIONS[kind].src);
  }

  // Bridge cap URLs (preload if any bridges exist)
  const hasBridges = [...usedKinds].some(
    (k) => k === "bridge_h" || k === "bridge_v",
  );
  if (hasBridges) {
    for (const src of Object.values(BRIDGE_CAP_SRCS)) urls.add(src);
  }

  // Batch-load all textures
  const textureMap = new Map<string, Texture>();
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const tex = await Assets.load<Texture>(url);
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

  for (const { x, y, kind } of decoEntries) {
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
  agentSearch: string,
  isMultiInstance: boolean,
  rosterInstances: AgentInstance[],
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
    const def = UNIT_DEFS[agent.unitChoice.kind];
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    const isWorking =
      agent.status === "working" || agent.status === "thinking";
    const { action } = getAgentActionAndFlip(x, y, isWorking, decorations);
    const state = getSheetState(action, def);
    neededUrls.add(unitSheetSrc(agent.unitChoice.faction, agent.unitChoice.kind, state));
    // Also preload idle for when agent becomes idle
    neededUrls.add(unitSheetSrc(agent.unitChoice.faction, agent.unitChoice.kind, "idle"));
  }

  await Promise.all(
    [...neededUrls].map((url) =>
      Assets.load<Texture>(url).catch(() => {
        /* silently skip missing sheets */
      }),
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

  // ── Build a Container per agent ────────────────────────────────────────────
  for (const { x, y, ref } of sortedEntries) {
    const agent = agentsById.get(ref.agentId);
    if (!agent) continue;

    const def = UNIT_DEFS[agent.unitChoice.kind];
    const isWorking =
      agent.status === "working" || agent.status === "thinking";
    const { action, flip } = getAgentActionAndFlip(x, y, isWorking, decorations);
    const state = getSheetState(action, def);

    // Resolve the texture; fall back to idle if the action sheet failed to load
    let sheetUrl = unitSheetSrc(agent.unitChoice.faction, agent.unitChoice.kind, state);
    let sheetTex: Texture | null = Assets.get<Texture>(sheetUrl) ?? null;
    if (!sheetTex && state !== "idle") {
      sheetUrl = unitSheetSrc(agent.unitChoice.faction, agent.unitChoice.kind, "idle");
      sheetTex = Assets.get<Texture>(sheetUrl) ?? null;
    }
    if (!sheetTex) continue;

    // Determine which frame count to use
    const frameCount =
      state === "idle"
        ? def.idle.frames
        : state === "run"
          ? def.run.frames
          : state === "axe"
            ? (def.axe?.frames ?? def.idle.frames)
            : state === "hammer"
              ? (def.hammer?.frames ?? def.idle.frames)
              : state === "pickaxe"
                ? (def.pickaxe?.frames ?? def.idle.frames)
                : state === "knife"
                  ? (def.knife?.frames ?? def.idle.frames)
                  : def.idle.frames;

    // Slice the horizontal strip into individual frame textures
    const frameTextures: Texture[] = Array.from({ length: frameCount }, (_, i) =>
      new Texture({
        source: sheetTex!.source,
        frame: new Rectangle(i * def.frameW, 0, def.frameW, def.frameH),
      }),
    );

    // ── Sprite math: scale bbox to AGENT_SIZE ──────────────────────────────
    const spriteScale = AGENT_SIZE / Math.max(def.bbox.w, def.bbox.h);
    const padX = (AGENT_SIZE - def.bbox.w * spriteScale) / 2;
    const padY = (AGENT_SIZE - def.bbox.h * spriteScale) / 2;
    const spriteX = padX - def.bbox.x * spriteScale;
    const spriteY = padY - def.bbox.y * spriteScale;
    // Mirror: when flipping (scale.x = -spriteScale), the pixel at frame-coord fx
    // renders at: container_x = spriteX' + fx * (-spriteScale)
    // To match CSS scaleX(-1) around the 96px wide box:
    //   container_x_flipped = AGENT_SIZE - (spriteX + fx * spriteScale)
    // → spriteX'(flip) = AGENT_SIZE - spriteX
    const spriteXFlip = AGENT_SIZE - spriteX;

    // ── Agent position on tile ─────────────────────────────────────────────
    const onBridge = isBridgeCell(x, y, grid, decorations);
    const agentLeft = x * TILE + (TILE - AGENT_SIZE) / 2;
    const agentTop =
      y * TILE + (TILE - AGENT_SIZE) / 2 - (onBridge ? Math.round(TILE * 0.35) : 0);

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
    agentContainer.addChild(animSprite);

    // ── Instance badge ─────────────────────────────────────────────────────
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
      badge.x = AGENT_SIZE - 2;
      badge.y = AGENT_SIZE - 2;
      agentContainer.addChild(badge);
    }

    // ── Search dimming ─────────────────────────────────────────────────────
    const searchMatch =
      !agentSearch ||
      agent.name.toLowerCase().includes(agentSearch.toLowerCase());
    agentContainer.alpha = searchMatch ? 1 : 0.2;

    agentLayer.addChild(agentContainer);
  }
}
