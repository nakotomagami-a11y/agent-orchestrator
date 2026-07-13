import { type DecorationKind, type DecorationsMap, familyOf, BRIDGE_CAPS } from "../components/decorations";
import type { VisibleRange } from "../components/office-map";

export function buildDecoList(
  decorations: DecorationsMap,
  visibleRange: VisibleRange | undefined,
): Array<{ x: number; y: number; kind: DecorationKind; layer: number }> {
  const list: Array<{ x: number; y: number; kind: DecorationKind; layer: number }> = [];
  for (const [key, stack] of Object.entries(decorations)) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    if (visibleRange && (x < visibleRange.xMin || x > visibleRange.xMax || y < visibleRange.yMin || y > visibleRange.yMax)) continue;
    for (let layer = 0; layer < stack.length; layer++) {
      list.push({ x, y, kind: stack[layer]!, layer });
    }
  }
  list.sort((a, b) => a.y - b.y || a.layer - b.layer);
  return list;
}

export function buildBridgeCaps(
  decorations: DecorationsMap,
  grid: boolean[][],
  visibleRange: VisibleRange | undefined,
): Array<{ x: number; y: number; src: string }> {
  const caps: Array<{ x: number; y: number; src: string }> = [];
  const isLand = (cx: number, cy: number): boolean => grid[cy]?.[cx] === true;
  for (const [key, stack] of Object.entries(decorations)) {
    if (!stack.some((k) => familyOf(k) === "bridge")) continue;
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    const hasH = stack.includes("bridge_h");
    const hasV = stack.includes("bridge_v");
    if (hasH) {
      if (isLand(x - 1, y)) {
        const cx = x - 1;
        if (!visibleRange || (cx >= visibleRange.xMin && cx <= visibleRange.xMax && y >= visibleRange.yMin && y <= visibleRange.yMax))
          caps.push({ x: cx, y, src: BRIDGE_CAPS.h_l.src });
      }
      if (isLand(x + 1, y)) {
        const cx = x + 1;
        if (!visibleRange || (cx >= visibleRange.xMin && cx <= visibleRange.xMax && y >= visibleRange.yMin && y <= visibleRange.yMax))
          caps.push({ x: cx, y, src: BRIDGE_CAPS.h_r.src });
      }
    }
    if (hasV) {
      if (isLand(x, y - 1)) {
        const cy = y - 1;
        if (!visibleRange || (x >= visibleRange.xMin && x <= visibleRange.xMax && cy >= visibleRange.yMin && cy <= visibleRange.yMax))
          caps.push({ x, y: cy, src: BRIDGE_CAPS.v_t.src });
      }
      if (isLand(x, y + 1)) {
        const cy = y + 1;
        if (!visibleRange || (x >= visibleRange.xMin && x <= visibleRange.xMax && cy >= visibleRange.yMin && cy <= visibleRange.yMax))
          caps.push({ x, y: cy, src: BRIDGE_CAPS.v_b.src });
      }
    }
  }
  return caps;
}
