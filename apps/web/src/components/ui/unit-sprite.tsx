"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import {
  getUnitClockFrame,
  getUnitClockServerFrame,
  subscribeUnitClock,
} from "./unit-sprite.clock";
import {
  UNIT_DEFS,
  unitSheetSrc,
  type UnitSelection,
} from "./unit-sprite.utils";

export type UnitSpriteProps = {
  unit: UnitSelection;
  /** Square avatar size in CSS pixels. Defaults to 48. */
  size?: number;
  /** Loop the sprite-sheet animation. Disable in very dense lists. */
  animate?: boolean;
  /** Which action sheet to play. "axe" requires the kind to have an axe
   *  sheet declared in UNIT_DEFS (pawn does); otherwise falls back to idle. */
  action?: "idle" | "working" | "axe";
  /** Mirror horizontally — used when the contextual target (e.g. a tree
   *  being chopped) is on the pawn's left rather than its default right. */
  flip?: boolean;
  /** Optional accessible label. Decorative by default. */
  label?: string;
  className?: string;
};

/**
 * Animated Tiny Swords unit avatar. Uses CSS background-position to step
 * through the sheet, driven by a shared rAF clock so N sprites cost one loop.
 *
 * Respects `prefers-reduced-motion`: the animation pauses on the first frame.
 */
export function UnitSprite({
  unit,
  size = 48,
  animate = true,
  action = "idle",
  flip = false,
  label,
  className,
}: UnitSpriteProps) {
  // Defensive: a missing or malformed `unit` shouldn't crash the whole page.
  // Render a placeholder square and shout in the console so the offending
  // callsite shows up in dev. Types should catch this at compile time but
  // any cast / persisted data / out-of-tree mutation could still break the
  // invariant — and "blank avatar" beats "white page of death".
  const def =
    unit && typeof unit.kind === "string" ? UNIT_DEFS[unit.kind] : undefined;
  if (!def) {
    if (typeof window !== "undefined") {
      console.warn(
        "[UnitSprite] missing unit definition; rendering placeholder. Got:",
        unit,
      );
    }
    return (
      <div
        className={cn("unit-sprite", className)}
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          background: "var(--bg-2)",
          border: "1px dashed var(--line)",
          borderRadius: 4,
        }}
        aria-hidden
        title={`Unknown unit: ${JSON.stringify(unit ?? null)}`}
      />
    );
  }
  // Pick the sheet for the requested action. "axe" gracefully falls back
  // to idle when the kind doesn't have an axe sheet declared (only pawns
  // do today), so non-pawn units never miss their sprite if a future rule
  // accidentally routes "axe" to them.
  const sheet =
    action === "working"
      ? def.run
      : action === "axe" && def.axe
        ? def.axe
        : def.idle;
  const state: "idle" | "run" | "axe" =
    action === "working" ? "run" : action === "axe" && def.axe ? "axe" : "idle";
  const src = unitSheetSrc(unit.faction, unit.kind, state);

  const reducedMotion = usePrefersReducedMotion();
  const ticking = animate && !reducedMotion && sheet.frames > 1;
  const frame = useUnitFrame(ticking) % sheet.frames;

  // Scale so the character bbox fits inside the avatar square (preserving
  // aspect). The remaining transparent margin is the natural padding.
  const scale = size / Math.max(def.bbox.w, def.bbox.h);
  const frameW = def.frameW * scale;
  const sheetW = frameW * sheet.frames;
  const sheetH = def.frameH * scale;

  // Centre the bbox inside the square; some kinds (Lancer) are tall+narrow so
  // they'll have horizontal slack, while Pawn-style sprites fit edge-to-edge.
  const padX = (size - def.bbox.w * scale) / 2;
  const padY = (size - def.bbox.h * scale) / 2;
  const offX = padX - (def.bbox.x * scale + frame * frameW);
  const offY = padY - def.bbox.y * scale;

  const ariaProps = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true };

  return (
    <div
      className={cn("unit-sprite", className)}
      style={{
        width: size,
        height: size,
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
        // Mirroring is applied to the wrapper so the background-position
        // math below stays in the source sheet's coordinate space.
        transform: flip ? "scaleX(-1)" : undefined,
      }}
      {...ariaProps}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${src})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${sheetW}px ${sheetH}px`,
          backgroundPosition: `${offX}px ${offY}px`,
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}

function useUnitFrame(active: boolean): number {
  return useSyncExternalStore(
    active ? subscribeUnitClock : noopSubscribe,
    active ? getUnitClockFrame : getStaticFrame,
    getUnitClockServerFrame,
  );
}

function noopSubscribe(): () => void {
  return () => {};
}

function getStaticFrame(): number {
  // When the sprite is paused, snap to the first frame.
  return 0;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
