import type { Pen } from "../pen";
import type { Color } from "../types";
import { Vector, Bounds, diagToPosition } from "../math";
import { colorDarken, colorLerp, colorLighten, colorStr, hsvToRgb } from "../color";

// A haft along the diagonal capped by a gem near the top corner. Handle
// variations: wand vs staff scale; wood / dark-metal / bone / lacquer shafts;
// decorative metal bands; and a gem setting (collar, gripping claws, or bare).
// The gem is rendered richly — a glossy orb (inner core-glow + specular) or a
// faceted cut crystal — finished with sparkles and a soft magical bloom.
export function drawStaff(pen: Pen): void {
  pen.rng.checkpoint();
  const r = pen.rng;

  const bounds = new Bounds(0, 0, pen.dimension, pen.dimension);
  const dscale = bounds.h / 32;

  pen.clearCanvas();

  const isWand = r.float() < 0.4;
  const gemRadius = (isWand ? r.rangeFloat(2.4, 3.4) : r.rangeFloat(3.6, 5.6)) * dscale;
  const haftMaxRadius = (isWand ? r.rangeFloat(0.9, 1.4) : r.rangeFloat(1.4, 2.3)) * dscale;

  // Gem near the top-right corner, inset enough that claws / sparkles don't clip.
  const gemOrtho = bounds.h - 1 - Math.ceil(gemRadius * 1.25) - 1;
  const gemCenter = new Vector(gemOrtho, bounds.h - 1 - gemOrtho);

  // Shaft material.
  const mat = r.float();
  const haftColor =
    mat < 0.36
      ? hsvToRgb({ h: r.range(26, 42), s: r.rangeFloat(0.45, 0.72), v: r.rangeFloat(0.4, 0.62) }) // wood
      : mat < 0.62
        ? hsvToRgb({ h: r.range(0, 360), s: r.floatLow() * 0.15, v: r.rangeFloat(0.26, 0.42) }) // dark metal
        : mat < 0.82
          ? hsvToRgb({ h: r.range(30, 50), s: r.rangeFloat(0.1, 0.24), v: r.rangeFloat(0.74, 0.9) }) // bone
          : hsvToRgb({ h: r.range(0, 360), s: r.rangeFloat(0.5, 0.82), v: r.rangeFloat(0.38, 0.58) }); // lacquer

  const haftTopDiag = (gemOrtho - gemRadius * 0.4) * Math.sqrt(2);
  pen.drawHaftHelper({
    startDiag: 0,
    lengthDiag: haftTopDiag,
    maxRadius: haftMaxRadius,
    fractionalRadiusAllowed: true,
    color: haftColor,
  });

  // Metal accent: gold or silver, reused for bands / setting / finial.
  const gold = r.float() < 0.55;
  const metal = gold
    ? hsvToRgb({ h: r.range(36, 48), s: r.rangeFloat(0.5, 0.8), v: r.rangeFloat(0.72, 0.95) })
    : hsvToRgb({ h: r.range(0, 360), s: r.floatLow() * 0.12, v: r.rangeFloat(0.78, 0.95) });
  const metalDark = colorDarken(metal, 0.5);

  // Handle detail: either a cord-wrapped grip section or thin metal ring cuffs
  // that hug the shaft (not beads sitting on top of it).
  if (r.float() < 0.35) {
    pen.drawGripHelper({
      startDiag: haftTopDiag * r.rangeFloat(0.22, 0.4),
      lengthDiag: haftTopDiag * r.rangeFloat(0.16, 0.28),
      minRadius: haftMaxRadius,
      maxRadius: haftMaxRadius + 0.8 * dscale,
      fractionalRadiusAllowed: true,
    });
  } else {
    const rings = r.rangeLow(0, 3);
    for (let i = 0; i < rings; i++) {
      const frac = (i + 1) / (rings + 1);
      drawShaftRing(pen, bounds, haftTopDiag * (0.28 + 0.5 * frac), haftMaxRadius, dscale, metal, metalDark);
    }
  }

  // Base finial.
  if (r.float() < 0.72) {
    const baseR = haftMaxRadius + 0.4 * dscale;
    pen.drawRoundOrnamentHelper({
      center: new Vector(Math.floor(baseR) + 1, Math.ceil(bounds.h - baseR - 2)),
      radius: baseR,
      colorLight: metal,
    });
  }

  // Gem setting: a metal collar ring at the join, gripping claws, or bare.
  const setting = r.float();
  if (setting < 0.5) {
    drawShaftRing(pen, bounds, (gemOrtho - gemRadius * 0.7) * Math.SQRT2, haftMaxRadius + 0.4 * dscale, dscale, metal, metalDark);
  }

  // Gem palette.
  const h = r.range(0, 360);
  const s = r.rangeFloat(0.65, 1);
  const v = r.rangeFloat(0.85, 1);
  const gemLight = hsvToRgb({ h, s, v });
  const gemDark = colorDarken(gemLight, 0.62);
  const gemCore = colorLighten(gemLight, 0.5);
  const spec = colorLighten(gemLight, 0.85);

  if (r.float() < 0.42) {
    drawFacet(pen, gemCenter.x, gemCenter.y, gemRadius, gemDark, gemLight, gemCore, spec);
  } else {
    drawOrb(pen, gemCenter.x, gemCenter.y, gemRadius, gemDark, gemLight, gemCore, spec);
  }

  // Gripping claws (drawn over the gem base so the tips read in front).
  if (setting >= 0.5 && setting < 0.8) {
    const clawBase = diagToPosition((gemOrtho - gemRadius * 0.55) * Math.sqrt(2), bounds);
    const clawHalf = Math.max(1, 0.85 * dscale);
    for (const side of [-1, 1]) {
      const a = -Math.PI / 4 + side * 0.62;
      pen.fillCone(clawBase.x, clawBase.y, Math.cos(a), Math.sin(a), 0, gemRadius * 1.45, clawHalf, metal, metalDark);
    }
  } else if (setting >= 0.8) {
    // Bare gem: allow an orbit decoration.
    const deco = r.float();
    if (deco < 0.5) {
      const n = r.range(2, 5);
      const phase = r.rangeFloat(0, Math.PI * 2);
      const orbitR = gemRadius * 1.8;
      const satR = Math.max(1, gemRadius * 0.3);
      const satLight = colorLighten(gemLight, 0.25);
      for (let i = 0; i < n; i++) {
        const a = phase + (i * Math.PI * 2) / n;
        pen.drawRoundOrnamentHelper({
          center: new Vector(gemCenter.x + Math.cos(a) * orbitR, gemCenter.y + Math.sin(a) * orbitR),
          radius: satR,
          colorLight: satLight,
        });
      }
    } else if (deco < 0.75) {
      const ringR = gemRadius * 1.5;
      const ringColor = colorStr(metal);
      for (let x = Math.floor(gemCenter.x - ringR - 1); x <= Math.ceil(gemCenter.x + ringR + 1); x++) {
        for (let y = Math.floor(gemCenter.y - ringR - 1); y <= Math.ceil(gemCenter.y + ringR + 1); y++) {
          if (x < 0 || y < 0 || x >= bounds.w || y >= bounds.h) continue;
          if (Math.abs(gemCenter.distanceTo(x, y) - ringR) <= Math.max(0.7, 0.45 * dscale)) {
            pen.ctx.fillStyle = ringColor;
            pen.drawPixel(x, y);
          }
        }
      }
    }
  }

  pen.addBorder();

  // Bloom + sparkles, over the outline so they read as light.
  if (isWand || r.float() < 0.6) pen.drawGlow(gemCenter, gemRadius * 2.5, gemLight);
  if (r.float() < 0.72) {
    const nSpark = r.range(1, 4);
    for (let i = 0; i < nSpark; i++) {
      const a = -Math.PI / 2 + r.rangeFloat(-1.4, 1.4);
      const dist = gemRadius * (0.55 + 0.55 * r.float());
      drawSparkle(pen, Math.round(gemCenter.x + Math.cos(a) * dist), Math.round(gemCenter.y + Math.sin(a) * dist), r.range(1, 3), spec);
    }
  }
}

/** Glossy sphere gem: directional shade + translucent inner core-glow + a
 *  crisp specular dot + darkened rim. */
function drawOrb(pen: Pen, cx: number, cy: number, rad: number, dark: Color, light: Color, core: Color, spec: Color): void {
  const specX = cx - rad * 0.36;
  const specY = cy - rad * 0.36;
  const specR = Math.max(1.3, rad * 0.3);
  for (let x = Math.floor(cx - rad - 1); x <= Math.ceil(cx + rad + 1); x++) {
    for (let y = Math.floor(cy - rad - 1); y <= Math.ceil(cy + rad + 1); y++) {
      if (x < 0 || y < 0 || x >= pen.dimension || y >= pen.dimension) continue;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > rad + 0.4) continue;
      const nd = Math.min(1, d / rad);
      const nx = dx / rad;
      const ny = dy / rad;
      const lightAmt = Math.max(0, Math.min(1, 0.55 - (nx + ny) * 0.4));
      let c = colorLerp(dark, light, lightAmt);
      c = colorLerp(c, core, Math.pow(Math.max(0, 1 - nd), 1.7) * 0.55);
      if (nd > 0.78) c = colorDarken(c, ((nd - 0.78) / 0.22) * 0.5);
      const sd = Math.hypot(x - specX, y - specY);
      if (sd < specR) c = colorLerp(c, spec, Math.pow(1 - sd / specR, 1.4) * 0.95);
      pen.ctx.fillStyle = colorStr(c);
      pen.drawPixel(x, y);
    }
  }
}

/** Faceted cut crystal: a diamond with a bright table facet, four graded side
 *  facets, seam lines and a specular glint. */
function drawFacet(pen: Pen, cx: number, cy: number, rad: number, dark: Color, light: Color, core: Color, spec: Color): void {
  const specX = cx - rad * 0.26;
  const specY = cy - rad * 0.34;
  const specR = Math.max(1.2, rad * 0.24);
  for (let x = Math.floor(cx - rad - 1); x <= Math.ceil(cx + rad + 1); x++) {
    for (let y = Math.floor(cy - rad - 1); y <= Math.ceil(cy + rad + 1); y++) {
      if (x < 0 || y < 0 || x >= pen.dimension || y >= pen.dimension) continue;
      const nx = (x - cx) / rad;
      const ny = (y - cy) / rad;
      const m = Math.abs(nx) + Math.abs(ny);
      if (m > 1.0) continue;
      let c: Color;
      if (m < 0.4) {
        c = colorLerp(light, core, 0.5); // table
      } else {
        const b = ny < 0 ? (nx < 0 ? 0.9 : 0.66) : nx < 0 ? 0.46 : 0.3;
        c = colorLerp(dark, light, b);
      }
      if (Math.abs(m - 0.4) < 0.06) c = colorDarken(c, 0.28); // table edge
      else if (Math.abs(nx) < 0.06 && m > 0.4) c = colorDarken(c, 0.22); // vertical seam
      if (m > 0.9) c = colorDarken(c, ((m - 0.9) / 0.1) * 0.42); // rim
      const sd = Math.hypot(x - specX, y - specY);
      if (sd < specR) c = colorLerp(c, spec, Math.pow(1 - sd / specR, 1.3) * 0.9);
      pen.ctx.fillStyle = colorStr(c);
      pen.drawPixel(x, y);
    }
  }
}

/** A thin metal band wrapping across the shaft at `diag` — a binding/ferrule,
 *  drawn perpendicular to the diagonal so it hugs the stick instead of sitting
 *  on top like a bead. */
function drawShaftRing(
  pen: Pen,
  bounds: Bounds,
  diag: number,
  halfWidth: number,
  dscale: number,
  light: Color,
  dark: Color,
): void {
  const ortho = diag / Math.SQRT2;
  const cx = ortho;
  const cy = bounds.h - 1 - ortho;
  const fwd = Math.SQRT1_2; // shaft direction (x, -y)
  const perp = Math.SQRT1_2; // across the shaft (x, y)
  const halfW = halfWidth + 0.8 * dscale;
  const halfT = Math.max(0.6, 0.7 * dscale);
  const litStr = colorStr(light);
  const darkStr = colorStr(dark);
  for (let t = -halfW; t <= halfW; t += 0.5) {
    for (let u = -halfT; u <= halfT; u += 0.5) {
      const x = Math.round(cx + perp * t + fwd * u);
      const y = Math.round(cy + perp * t - fwd * u);
      if (x < 0 || y < 0 || x >= bounds.w || y >= bounds.h) continue;
      pen.ctx.fillStyle = t > halfW * 0.35 ? darkStr : litStr;
      pen.drawPixel(x, y);
    }
  }
}

/** A 4-point twinkle: bright center with fading arms. */
function drawSparkle(pen: Pen, cx: number, cy: number, size: number, color: Color): void {
  const rr = Math.floor(color.r);
  const gg = Math.floor(color.g);
  const bb = Math.floor(color.b);
  for (let i = -size; i <= size; i++) {
    if (i === 0) continue;
    const a = (1 - Math.abs(i) / (size + 1)) * 0.9;
    pen.ctx.fillStyle = `rgba(${rr},${gg},${bb},${a.toFixed(2)})`;
    pen.drawPixel(cx + i, cy);
    pen.drawPixel(cx, cy + i);
  }
  pen.ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
  pen.drawPixel(cx, cy);
}
