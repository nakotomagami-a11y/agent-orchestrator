import type { Pen } from "../pen";
import { Vector, Bounds, diagToPosition } from "../math";
import { colorDarken, colorLerp, colorStr, hsvToRgb } from "../color";

// Not part of the original Icon Machine. A haft along the bottom-left→top-right
// diagonal with a procedural axe head (a half-elliptical "bit") flaring off one
// or both sides near the top, plus an optional back spike.
export function drawAxe(pen: Pen): void {
  pen.rng.checkpoint();
  const r = pen.rng;

  const bounds = new Bounds(0, 0, pen.dimension, pen.dimension);
  const dscale = bounds.h / 32;
  const canvasDiag = Math.sqrt(bounds.w * bounds.w + bounds.h * bounds.h);

  pen.clearCanvas();

  // Haft runs the full diagonal, its top end sitting a little short of the corner
  // so the head has room.
  const headDiag = canvasDiag - Math.ceil(r.range(5, 9) * dscale);
  pen.drawHaftHelper({
    startDiag: 0,
    lengthDiag: headDiag,
    // Pre-scale to pixel units now that drawHaftHelper no longer applies dscale.
    maxRadius: Math.max(1, r.range(1, 2)) * dscale,
    fractionalRadiusAllowed: true,
  });

  // Head anchor: on the haft, a touch below its top so the bit hugs the shaft.
  const anchorDiag = headDiag - Math.floor(r.range(1, 4) * dscale);
  const anchor = diagToPosition(anchorDiag, bounds);

  // Frame aligned with the haft: u = forward (toward top-right), n = outward (top-left).
  const u = new Vector(1, -1).normalize();
  const n = new Vector(-1, -1).normalize();

  // Bit dimensions.
  const halfLen = r.rangeFloat(6, 10) * dscale; // extent along the haft
  const bitDepth = r.rangeFloat(7, 11) * dscale; // how far the bit flares out
  const doubleBit = r.float() > 0.55; // symmetric head both sides
  const backSpike = !doubleBit && r.float() > 0.5; // small poll spike opposite the bit

  // Metal colors (desaturated, like the crossguard helper).
  const light = hsvToRgb({ h: r.range(0, 360), s: r.floatLow() * 0.35, v: r.rangeFloat(0.72, 1) });
  const dark = colorDarken(light, 0.62);

  // Optional slight forward sweep of the cutting edge for a bearded-axe look.
  const sweep = r.rangeFloat(-0.25, 0.25);

  // Axe-bit membership. In the (s = along haft, d = outward) frame the bit is a
  // fan that flares from a narrow neck at the haft to a wide, convex cutting edge:
  //   - sides:  |s| <= width(d),  width grows with d  →  neck → wide edge
  //   - edge:   d <= edgeMax(s),  a shallow arc        →  convex cutting edge
  const wNeck = Math.max(1, 1.6 * dscale);
  const drawBit = (sign: number) => {
    for (let x = 0; x < bounds.w; x++) {
      for (let y = 0; y < bounds.h; y++) {
        const px = x - anchor.x;
        const py = y - anchor.y;
        const s = px * u.x + py * u.y + sweep * ((px * n.x + py * n.y) * sign);
        const d = (px * n.x + py * n.y) * sign;
        if (d < 0 || d > bitDepth) continue;
        const flare = d / bitDepth; // 0 at neck, 1 at edge
        const width = wNeck + (halfLen - wNeck) * Math.pow(flare, 0.6);
        if (Math.abs(s) > width) continue;
        const tEdge = Math.min(1, Math.abs(s) / halfLen);
        const edgeMax = bitDepth * (0.8 + 0.2 * (1 - tEdge * tEdge)); // convex bulge mid
        if (d > edgeMax) continue;
        // Depth shading: dark thick neck/back → brighter face, a bright sharpened
        // cutting edge along the outer arc, rounded (shadowed) toward the tips,
        // plus a soft mid-face sheen.
        const lat = Math.abs(s) / (width || 1);
        const edgeProx = d / edgeMax;
        let shade = 0.24 + 0.46 * flare;
        if (edgeProx > 0.78) shade += 0.55 * ((edgeProx - 0.78) / 0.22);
        shade -= 0.3 * Math.pow(lat, 1.6);
        shade += 0.14 * Math.max(0, 1 - Math.abs(flare - 0.5) / 0.3);
        shade = Math.max(0, Math.min(1, shade));
        pen.ctx.fillStyle = colorStr(colorLerp(dark, light, shade));
        pen.drawPixel(x, y);
      }
    }
  };

  drawBit(1);
  if (doubleBit) drawBit(-1);

  // Back spike (poll) for single-bit battle axes: a short beveled wedge opposite
  // the bit (fillCone gives it the same cross-sectional depth).
  if (backSpike) {
    const spikeLen = r.rangeFloat(3, 6) * dscale;
    const spikeHalf = r.rangeFloat(1.5, 3) * dscale;
    pen.fillCone(anchor.x, anchor.y, -n.x, -n.y, 0, spikeLen, spikeHalf, light, dark);
  }

  // Pommel/end cap at the base of the haft.
  if (r.float() > 0.5) {
    const pommelRadius = Math.ceil((0.5 + r.floatLow() * 0.6) * dscale);
    pen.drawRoundOrnamentHelper({
      center: new Vector(Math.floor(pommelRadius), Math.ceil(bounds.h - pommelRadius - 1)),
      radius: pommelRadius,
      colorLight: hsvToRgb({ h: r.range(35, 45), s: r.float() * 0.6, v: r.rangeFloat(0.5, 0.9) }),
    });
  }

  pen.addBorder();
}
