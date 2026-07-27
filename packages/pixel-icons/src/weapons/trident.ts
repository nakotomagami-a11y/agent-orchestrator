import type { Pen } from "../pen";
import { Vector, Bounds } from "../math";
import { colorDarken, hsvToRgb } from "../color";

// A haft topped by a crossbar and a fan of tapered prongs. Variations:
// trident (2-3 prongs, steel, optional barbs) vs pitchfork (3-4 thin tines).
export function drawTrident(pen: Pen): void {
  pen.rng.checkpoint();
  const r = pen.rng;

  const bounds = new Bounds(0, 0, pen.dimension, pen.dimension);
  const dscale = bounds.h / 32;

  pen.clearCanvas();

  const isPitchfork = r.float() < 0.4;
  const prongCount = isPitchfork ? r.range(3, 5) : r.float() < 0.25 ? 2 : 3;
  const prongLen = (isPitchfork ? r.rangeFloat(11, 16) : r.rangeFloat(9, 14)) * dscale;
  const prongHalf = (isPitchfork ? r.rangeFloat(0.7, 1.0) : r.rangeFloat(0.95, 1.45)) * dscale;
  const baseSpread = (isPitchfork ? r.rangeFloat(4.5, 7) : r.rangeFloat(3, 5)) * dscale;
  const splay = isPitchfork ? r.rangeFloat(0.04, 0.14) : r.rangeFloat(0.12, 0.32);
  const hasBarbs = !isPitchfork && r.float() < 0.5;

  const forward = -Math.PI / 4;
  const perpFx = Math.cos(forward + Math.PI / 2);
  const perpFy = Math.sin(forward + Math.PI / 2);

  const baseOrtho = bounds.h - 1 - Math.ceil(prongLen * 0.72) - 1;
  const baseCenter = new Vector(baseOrtho, bounds.h - 1 - baseOrtho);

  const haftColor = isPitchfork
    ? hsvToRgb({ h: r.range(26, 42), s: r.rangeFloat(0.45, 0.7), v: r.rangeFloat(0.4, 0.6) })
    : hsvToRgb({ h: r.range(0, 360), s: r.floatLow() * 0.2, v: r.rangeFloat(0.45, 0.7) });
  pen.drawHaftHelper({
    startDiag: 0,
    lengthDiag: (baseOrtho - prongHalf) * Math.sqrt(2),
    maxRadius: r.rangeFloat(1.1, 1.8) * dscale,
    fractionalRadiusAllowed: true,
    color: haftColor,
  });

  const steel = hsvToRgb({ h: r.range(0, 360), s: r.floatLow() * 0.15, v: r.rangeFloat(0.78, 1) });
  const steelDark = colorDarken(steel, 0.55);

  // Crossbar (two cones back-to-back → a tapered bar).
  const barHalf = baseSpread / 2 + prongHalf;
  pen.fillCone(baseCenter.x, baseCenter.y, perpFx, perpFy, 0, barHalf, prongHalf * 1.5, steel, steelDark);
  pen.fillCone(baseCenter.x, baseCenter.y, -perpFx, -perpFy, 0, barHalf, prongHalf * 1.5, steel, steelDark);

  // Prongs fanning off the crossbar.
  for (let i = 0; i < prongCount; i++) {
    const frac = prongCount === 1 ? 0.5 : i / (prongCount - 1);
    const lat = (frac - 0.5) * baseSpread;
    const bx = baseCenter.x + perpFx * lat;
    const by = baseCenter.y + perpFy * lat;
    const a = forward + (frac - 0.5) * 2 * splay;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    // Middle tine of a trident runs a touch longer.
    const isMid = !isPitchfork && prongCount === 3 && i === 1;
    const len = prongLen * (isMid ? 1.0 : isPitchfork ? 1.0 : 0.92);
    pen.fillCone(bx, by, dx, dy, 0, len, prongHalf, steel, steelDark);

    if (hasBarbs && (i === 0 || i === prongCount - 1)) {
      const side = i === 0 ? 1 : -1;
      const ba = a + side * Math.PI * 0.62;
      const barbX = bx + dx * len * 0.62;
      const barbY = by + dy * len * 0.62;
      pen.fillCone(barbX, barbY, Math.cos(ba), Math.sin(ba), 0, prongLen * 0.28, prongHalf * 0.9, steel, steelDark);
    }
  }

  // Ferrule where the head meets the haft.
  pen.drawRoundOrnamentHelper({
    center: baseCenter,
    radius: prongHalf + 0.9 * dscale,
    colorLight: hsvToRgb({ h: r.range(0, 360), s: r.floatLow() * 0.3, v: r.rangeFloat(0.6, 0.85) }),
  });

  // Base cap.
  if (r.float() < 0.6) {
    const baseR = Math.ceil(r.rangeFloat(1, 1.7) * dscale);
    pen.drawRoundOrnamentHelper({
      center: new Vector(Math.floor(baseR) + 1, Math.ceil(bounds.h - baseR - 2)),
      radius: baseR,
      colorLight: hsvToRgb({ h: r.range(26, 42), s: r.rangeFloat(0.4, 0.7), v: r.rangeFloat(0.45, 0.7) }),
    });
  }

  pen.addBorder();
}
