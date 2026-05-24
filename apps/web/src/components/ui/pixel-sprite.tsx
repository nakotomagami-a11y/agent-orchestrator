import { cn } from "@/lib/cn";
import {
  buildSpriteCells,
  SPRITE_H,
  SPRITE_W,
  type SpriteAction,
  type SpriteAgent,
} from "./pixel-sprite.utils";

export type PixelSpriteProps = {
  agent?: SpriteAgent;
  /** Square width in CSS pixels; height is derived to keep the 24x32 ratio. */
  size?: number;
  /** Idle-bob animation. Defaults to true; turn off in dense lists. */
  animate?: boolean;
  action?: SpriteAction;
  className?: string;
  /** Optional label for screen readers. Decorative by default. */
  label?: string;
};

/**
 * 24×32 pixel agent sprite. Pure SVG renderer; cell layout lives in
 * `pixel-sprite.utils.ts`. The eyes get their own group so the blink animation
 * can target them independently of the bob/typing wrappers.
 */
export function PixelSprite({
  agent,
  size = 64,
  animate = true,
  action = "idle",
  className,
  label,
}: PixelSpriteProps) {
  const { cells, typing } = buildSpriteCells(agent, action);
  const heightPx = (size * SPRITE_H) / SPRITE_W;
  const ariaProps = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true };

  return (
    <div className={cn("inline-block w-full h-full", className)}>
      <svg
        width={size}
        height={heightPx}
        viewBox={`0 0 ${SPRITE_W} ${SPRITE_H}`}
        shapeRendering="crispEdges"
        className={cn(
          animate && action !== "typing" && "animate-[bob_2.4s_infinite_ease-in-out] [transform-origin:center_bottom]",
          action === "typing" && "animate-[typeShake_0.18s_infinite_linear] [transform-origin:center_bottom]",
        )}
        {...ariaProps}
      >
        {cells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} fill={c.fill} />
        ))}
        <g className={animate ? "[transform-origin:center] animate-[blinkEye_4s_infinite_ease-in-out]" : undefined}>
          <rect x={9} y={9} width={1} height={1} fill="#1E1A18" />
          <rect x={14} y={9} width={1} height={1} fill="#1E1A18" />
        </g>
        {typing && action === "typing" ? (
          <rect x={6} y={20} width={12} height={1} fill="#E95420" opacity={0.5} />
        ) : null}
      </svg>
    </div>
  );
}
