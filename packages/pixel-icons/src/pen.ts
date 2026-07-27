/**
 * Pen — shared drawing surface for the weapon generators.
 * Extracted from IconGenerator — faithful TypeScript port of Brian MacIntosh's Icon Machine
 * procedural pixel-art weapon generator (blades, spears).
 *
 * The original also generates potions; that generator was dropped in this
 * build — only the weapon generators are ported.
 *
 * The original was a single `RandomArt` object bound to the page DOM. This
 * strips the UI: construct with a 2D canvas context + a square dimension, then
 * call `generate(config)`. Same seed + class → same icon on every device.
 *
 * The drawing math is kept 1:1 with the source (including its quirks) so output
 * matches the original pixel-for-pixel.
 */
import type { Color } from "./types";
import { Bounds, Vector, CorePoint, floatLerp } from "./math";
import { colorDarken, colorLerp, colorLighten, colorStr, hsvToRgb } from "./color";
import { Rng } from "./rng";

/** Subset of CanvasRenderingContext2D the generator relies on. */
export type Ctx2D = CanvasRenderingContext2D;

export interface IconOptions {
  /**
   * Outline color as [r, g, b], 0–255. The original uses pure black
   * ([0, 0, 0]); a dark desaturated tone (e.g. [26, 22, 34]) reads softer and
   * matches hand-drawn pixel-art outlines. Default: black.
   */
  border?: [number, number, number];
}

export class Pen {
  public ctx: Ctx2D;
  public dimension: number;
  public rng = new Rng();
  public translation = new Vector(0, 0);
  public border: [number, number, number];

  constructor(ctx: Ctx2D, dimension: number, options: IconOptions = {}) {
    this.ctx = ctx;
    this.dimension = dimension;
    this.border = options.border ?? [0, 0, 0];
  }

  // -- low-level canvas ------------------------------------------------------

  public clearCanvas(): void {
    this.ctx.fillStyle = "rgba(0,0,0,1)";
    this.ctx.clearRect(0, 0, this.dimension, this.dimension);
  }

  public drawPixel(x: number, y: number): void {
    this.ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  }

  /** Add a 1px black outline around the current drawing. */
  public addBorder(): void {
    const width = this.dimension;
    const height = this.dimension;
    const ox = this.translation.x;
    const oy = this.translation.y;

    const readData = this.ctx.getImageData(ox, oy, width, height);
    const mutableData = this.ctx.getImageData(ox, oy, width, height);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const pixelStart = (x + y * width) * 4;
        if (readData.data[pixelStart + 3] === 0 || x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          const nx = (x - 1 + y * width) * 4;
          const ny = (x + (y - 1) * width) * 4;
          const px = (x + 1 + y * width) * 4;
          const py = (x + (y + 1) * width) * 4;
          if (
            (x > 0 && readData.data[nx + 3]! > 0) ||
            (x < width - 1 && readData.data[px + 3]! > 0) ||
            (y > 0 && readData.data[ny + 3]! > 0) ||
            (y < height - 1 && readData.data[py + 3]! > 0)
          ) {
            mutableData.data[pixelStart + 0] = this.border[0];
            mutableData.data[pixelStart + 1] = this.border[1];
            mutableData.data[pixelStart + 2] = this.border[2];
            mutableData.data[pixelStart + 3] = 255;
          }
        }
      }
    }
    this.ctx.putImageData(mutableData, ox, oy);
  }

  // -- shared shape helpers --------------------------------------------------

  /** Soft radial alpha falloff, used as a post-outline bloom overlay. */
  public drawGlow(center: Vector, radius: number, color: Color): void {
    const rr = Math.floor(color.r);
    const gg = Math.floor(color.g);
    const bb = Math.floor(color.b);
    for (let x = Math.floor(center.x - radius); x <= Math.ceil(center.x + radius); x++) {
      for (let y = Math.floor(center.y - radius); y <= Math.ceil(center.y + radius); y++) {
        if (x < 0 || y < 0 || x >= this.dimension || y >= this.dimension) continue;
        const d = center.distanceTo(x, y);
        if (d > radius) continue;
        const t = 1 - d / radius;
        const alpha = t * t * 0.55;
        if (alpha < 0.02) continue;
        this.ctx.fillStyle = `rgba(${rr},${gg},${bb},${alpha.toFixed(3)})`;
        this.drawPixel(x, y);
      }
    }
  }

  /** Tapered cone from (cx,cy) along (dx,dy): width `halfBase` at `startD`,
   *  narrowing to a point at `startD+len`. Shaded by facing + tip. */
  public fillCone(
    cx: number,
    cy: number,
    dx: number,
    dy: number,
    startD: number,
    len: number,
    halfBase: number,
    light: Color,
    dark: Color,
  ): void {
    const reach = startD + len;
    const px = cx + dx * startD;
    const py = cy + dy * startD;
    const ex = cx + dx * reach;
    const ey = cy + dy * reach;
    const minX = Math.max(0, Math.floor(Math.min(px, ex) - halfBase - 1));
    const maxX = Math.min(this.dimension - 1, Math.ceil(Math.max(px, ex) + halfBase + 1));
    const minY = Math.max(0, Math.floor(Math.min(py, ey) - halfBase - 1));
    const maxY = Math.min(this.dimension - 1, Math.ceil(Math.max(py, ey) + halfBase + 1));
    // Which lateral side catches the top-left light, for a beveled cross-section.
    const litSign = dy - dx >= 0 ? 1 : -1;
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const rx = x - cx;
        const ry = y - cy;
        const d = rx * dx + ry * dy;
        if (d < startD || d > reach) continue;
        const s = rx * -dy + ry * dx;
        const w = halfBase * (1 - (d - startD) / len);
        if (Math.abs(s) > w) continue;
        // Beveled metal cross-section: one side lit, opposite dark, a raised
        // ridge down the centre and a darkened rim — the depth a flat gradient lacks.
        const nn = Math.max(-1, Math.min(1, s / (w || 1)));
        let shade = 0.5 + 0.42 * litSign * nn + 0.2 * (1 - Math.abs(nn));
        if (Math.abs(nn) > 0.8) shade -= 0.45 * ((Math.abs(nn) - 0.8) / 0.2);
        const tip = (d - startD) / len;
        shade = Math.max(0, Math.min(1, shade)) * (0.74 + 0.26 * tip);
        this.ctx.fillStyle = colorStr(colorLerp(dark, light, shade));
        this.drawPixel(x, y);
      }
    }
  }

  // -- blade helper ----------------------------------------------------------

  public drawBladeHelper(params: BladeParams): BladeResults {
    this.rng.checkpoint();
    const r = this.rng;

    const bounds = new Bounds(0, 0, this.dimension, this.dimension);
    const bounds1 = new Bounds(1, 1, bounds.w - 2, bounds.h - 2);
    const dscale = bounds.h / 32;

    const minimumBladeWidth = 1;
    const bladeSampleStepSize = Math.sqrt(2);
    const bladeEdgeWidth = 1;
    const bladeCoreEdgeExcludeWidth = 1;
    // The blade centerline is integrated one sample-step at a time, and the step
    // count grows with the render resolution — so per-step angular rates must be
    // divided by dscale, otherwise the persistent curvature (`omega`) integrates
    // to a full spiral at high resolution (the "blade loops into a snail" bug).
    // `jogAmount` is a one-off kink (scale-invariant in shape), so it stays; only
    // its per-step probability is normalized. At dscale=1 all of this is a no-op.
    const bladeJogChance = 0.04 / dscale;
    const bladeJogChanceLeadIn = Math.ceil(12 * dscale);
    const bladeJogAmount = Math.PI / 4;
    const bladeOmegaChance = 0.02 / dscale;
    const bladeOmegaAmount = Math.PI / 32 / dscale;
    const bladeMaxOmega = Math.PI / 32 / dscale;

    const bladeWidthCosineAmp = Math.ceil(Math.max(0, r.floatLow() * 1.2 - 0.2) * 2 * dscale);
    const bladeWidthCosineWavelength = Math.ceil(r.range(3 * Math.max(1, bladeWidthCosineAmp), 12) * dscale);
    const bladeWidthCosineOffset = r.rangeFloat(0, Math.PI * 2);

    // Wiggle is a heading *offset* (not integrated), and the wavelength already
    // scales with dscale — so the angular amplitude must stay constant, else the
    // physical wave grows as dscale² and the blade turns into a snake at high res.
    const bladeWiggleAmp = (Math.max(0, r.float() * 8 - 7) * Math.PI) / 4;
    const bladeWiggleWavelength = Math.ceil(r.rangeFloat(6, 18) * dscale);

    const bladeCorePoints: CorePoint[] = [];
    const bladeStartOrtho = Math.floor(params.startDiag / Math.sqrt(2));
    const currentPoint = new Vector(bladeStartOrtho, bounds.h - 1 - bladeStartOrtho);
    let currentDist = 0;
    const currentWidthL = params.startRadius;
    const currentWidthR = params.startRadius + r.range(-1, 2);
    const velocity = new Vector();
    const velocityScaled = new Vector();
    let angle = -Math.PI / 4;
    let omega = 0;
    do {
      const bladeWidthCosine = bladeWidthCosineAmp * Math.cos(bladeWidthCosineOffset + currentDist / bladeWidthCosineWavelength);
      const useAngle = angle + bladeWiggleAmp * Math.sin((Math.PI * 2 * currentDist) / bladeWiggleWavelength);
      velocity.set(Math.cos(useAngle), Math.sin(useAngle));

      const newPoint = new CorePoint(currentPoint);
      newPoint.widthL = Math.max(1, currentWidthL + bladeWidthCosine);
      newPoint.widthR = Math.max(1, currentWidthR + bladeWidthCosine);
      newPoint.normal = new Vector(-velocity.y, velocity.x).normalize();
      newPoint.forward = new Vector(velocity).normalize();
      newPoint.dist = currentDist;
      bladeCorePoints.push(newPoint);

      if (r.float() <= bladeJogChance * Math.min(1, currentDist / bladeJogChanceLeadIn)) {
        angle += r.rangeFloat(-bladeJogAmount, bladeJogAmount);
      }
      if (r.float() <= bladeOmegaChance) {
        omega += r.rangeFloat(-bladeOmegaAmount, bladeOmegaAmount);
        omega = Math.sign(omega) * Math.min(bladeMaxOmega, Math.abs(omega));
      }

      velocityScaled.set(velocity).multiplyScalar(bladeSampleStepSize);
      currentPoint.addVector(velocityScaled);
      currentDist += bladeSampleStepSize;
      angle += omega * bladeSampleStepSize;
    } while (bounds1.contains(currentPoint));

    for (const p of bladeCorePoints) {
      p.normalizedDist = p.dist! / currentDist;
      const invTaperFactor = 1 - params.taperFactor;
      const taper = p.normalizedDist <= invTaperFactor ? 1 : (1 - p.normalizedDist) / params.taperFactor;
      p.widthL! *= taper;
      p.widthR! *= taper;
    }

    const colorBladeLinearTip = hsvToRgb({
      h: r.rangeFloat(0, 360),
      s: r.float() < 0.3 ? r.floatExtreme() * 0.6 : 0,
      v: r.rangeFloat(0.75, 1),
    });
    const colorBladeLinearHilt = r.randomize(colorDarken(colorBladeLinearTip, 0.7), 16);
    const bladeEdgeLighten = 0.5;
    const bladeRightDarken = 0.5;

    for (let x = 0; x < bounds.w; x++) {
      for (let y = 0; y < bounds.h; y++) {
        const first = bladeCorePoints[0]!;
        const behind = first.forward.dotProduct(x - first.x, y - first.y);
        if (behind < 0) continue;

        let coreDistanceNorm = Infinity;
        let bestPoint: CorePoint | null = null;
        for (const cp of bladeCorePoints) {
          const dp = cp.normal!.dotProduct(x - cp.x, y - cp.y);
          const useWidth = dp < 0 ? cp.widthL! : cp.widthR!;
          const distanceNorm = cp.distanceTo(x, y) / useWidth;
          if (distanceNorm < coreDistanceNorm) {
            coreDistanceNorm = distanceNorm;
            bestPoint = cp;
          }
        }
        if (bestPoint == null) continue;

        const dp = bestPoint.normal!.dotProduct(x - bestPoint.x + 0.5, y - bestPoint.y + 0.5);
        const useWidth = dp < 0 ? bestPoint.widthL! : bestPoint.widthR!;
        const coreDistance = bestPoint.distanceTo(x, y);
        if (coreDistance <= useWidth || coreDistance <= minimumBladeWidth) {
          let color = colorLerp(colorBladeLinearHilt, colorBladeLinearTip, bestPoint.normalizedDist!);
          const edgeColor = colorLighten(color, bladeEdgeLighten);
          const darkColor = colorDarken(color, bladeRightDarken);
          const nonEdgeColor = dp > 0 ? darkColor : color;
          if (useWidth > bladeCoreEdgeExcludeWidth) {
            const edgeWidthMin = useWidth - bladeEdgeWidth;
            let edgeAmount = (coreDistance - edgeWidthMin) / bladeEdgeWidth;
            edgeAmount = 1 - (1 - edgeAmount) * (1 - edgeAmount);
            color = colorLerp(nonEdgeColor, edgeColor, edgeAmount);
          }
          this.ctx.fillStyle = colorStr(color);
          this.drawPixel(x, y);
        }
      }
    }

    return {
      startDiag: params.startDiag,
      startOrtho: bladeStartOrtho,
      startRadius: params.startRadius,
      hiltColor: colorBladeLinearHilt,
      tipColor: colorBladeLinearTip,
    };
  }

  // -- crossguard helper -----------------------------------------------------

  public drawCrossguardHelper(params: CrossguardParams): CrossguardResults {
    this.rng.checkpoint();
    const r = this.rng;

    const bounds = new Bounds(0, 0, this.dimension, this.dimension);

    const xguardColorLight = hsvToRgb({ h: r.range(0, 360), s: r.floatLow() * 0.5, v: r.rangeFloat(0.7, 1) });
    const xguardColorDark = colorDarken(xguardColorLight, 0.6);
    const xguardSymmetry = r.float() < 0.3 ? 0 : 1;
    const xguardThickness = params.thickness ?? r.rangeFloatHigh(1, 2.5);
    const xguardBottomTaper = r.float();
    const xguardTopTaper = floatLerp(r.float(), xguardBottomTaper, r.floatExtreme());
    const xguardOmegaChance = params.omegaChance ?? 0.3;
    const xguardOmegaAmount = params.omegaAmount ?? Math.PI / 8;
    // `^` is bitwise XOR here (not power) — faithful to the original source.
    const xguardMaxOmega = ((0 + (xguardThickness - 1)) ^ 2) * (Math.PI / 7);
    const xguardOmegaCooldown = 3;
    const xguardSampleStepSize = Math.sqrt(2);

    const start = new Vector(params.positionDiag, bounds.h - 1 - params.positionDiag);
    const currentPoint: [Vector, Vector] = [start, new Vector(start)];
    const xguardControlPoints: [CorePoint[], CorePoint[]] = [[], []];
    const xguardAngle: [number, number] = [(-Math.PI * 3) / 4, Math.PI / 4];
    const xguardOmega: [number, number] = [0, 0];
    const xguardOmegaCoolTimer: [number, number] = [0, 0];
    const deltaStep = xguardSampleStepSize / Math.sqrt(2);

    for (let progress = 0; progress <= params.halfLength; progress += xguardSampleStepSize) {
      for (const side of [0, 1] as const) {
        const newPoint = new CorePoint(currentPoint[side]);
        if (side === 1) {
          const symmetricPoint = new Vector(bounds.h - 1 - currentPoint[0].y, bounds.w - 1 - currentPoint[0].x);
          newPoint.lerpTo(symmetricPoint, xguardSymmetry);
        }
        newPoint.widthT = xguardThickness / 2;
        newPoint.widthB = xguardThickness / 2;
        const vel = new Vector(Math.cos(xguardAngle[side]), Math.sin(xguardAngle[side]));
        newPoint.normal = new Vector(vel.y, -vel.x).multiplyScalar(side * 2 - 1);
        newPoint.dist = progress;
        xguardControlPoints[side].push(newPoint);
      }
      for (const side of [0, 1] as const) {
        const vel = new Vector(Math.cos(xguardAngle[side]), Math.sin(xguardAngle[side]));
        xguardOmegaCoolTimer[side] -= xguardSampleStepSize;
        if (xguardOmegaCoolTimer[side] <= 0 && r.float() < xguardOmegaChance) {
          xguardOmegaCoolTimer[side] = xguardOmegaCooldown;
          xguardOmega[side] += r.rangeFloatExtreme(-xguardOmegaAmount, xguardOmegaAmount);
          xguardOmega[side] = Math.sign(xguardOmega[side]) * Math.min(xguardMaxOmega, Math.abs(xguardOmega[side]));
        }
        const step = new Vector(vel).multiplyScalar(xguardSampleStepSize);
        currentPoint[side].addVector(step);
        xguardAngle[side] += xguardOmega[side] * deltaStep;
      }
    }

    for (const side of [0, 1] as const) {
      for (const cp of xguardControlPoints[side]) {
        cp.normalizedDist = cp.dist / params.halfLength;
        cp.widthT *= Math.min(1, (1 - cp.normalizedDist) / xguardTopTaper);
        cp.widthB *= Math.min(1, (1 - cp.normalizedDist) / xguardBottomTaper);
      }
    }

    for (let x = 0; x < bounds.w; x++) {
      for (let y = 0; y < bounds.h; y++) {
        let coreDistanceSq = Infinity;
        let bestPoint: CorePoint | null = null;
        for (const side of [0, 1] as const) {
          for (const cp of xguardControlPoints[side]) {
            const distanceSq = cp.distanceToSq(x, y);
            if (distanceSq < coreDistanceSq) {
              coreDistanceSq = distanceSq;
              bestPoint = cp;
            }
          }
        }
        if (bestPoint == null) continue;
        const dp = bestPoint.normal!.dotProduct(x - bestPoint.x, y - bestPoint.y);
        const useWidth = dp < 0 ? bestPoint.widthB! : bestPoint.widthT!;
        const coreDistance = Math.sqrt(coreDistanceSq);
        if (coreDistance <= useWidth) {
          const distFromTop = dp < 0 ? bestPoint.widthT! + coreDistance : bestPoint.widthT! - coreDistance;
          const darkAmt = distFromTop / (bestPoint.widthB! + bestPoint.widthT!);
          this.ctx.fillStyle = colorStr(colorLerp(xguardColorLight, xguardColorDark, darkAmt));
          this.drawPixel(x, y);
        }
      }
    }

    return { colorLight: xguardColorLight, colorDark: xguardColorDark };
  }

  // -- grip / haft / rod -----------------------------------------------------

  public drawGripHelper(params: GripParams): void {
    this.rng.checkpoint();
    const r = this.rng;

    const bounds = new Bounds(0, 0, this.dimension, this.dimension);
    const dscale = bounds.h / 32;

    const minRadius = params.minRadius ? params.minRadius : 1;
    const maxRadius = params.maxRadius;
    // Radii arrive already in pixel units (callers derive them from scaled
    // blade/haft radii), so no extra `* dscale` here — the original port applied
    // it twice, making grips balloon quadratically at high render resolutions.
    const hiltRadius = params.fractionalRadiusAllowed
      ? 0.5 * Math.ceil(r.range(minRadius * 2, maxRadius * 2))
      : Math.ceil(r.range(minRadius, maxRadius));

    const hiltWavelength = Math.max(2, Math.ceil(r.range(3, 6) * dscale));
    const hiltColorLight = hsvToRgb({ h: r.range(0, 360), s: r.float(), v: r.rangeFloat(0.7, 1) });
    const hiltColorDark = colorDarken(hiltColorLight, 1);

    this.drawRodHelper({
      radius: hiltRadius,
      startDiag: params.startDiag,
      lengthDiag: params.lengthDiag * Math.sqrt(2),
      colorFunc: (l) => {
        const gripWave = Math.abs(Math.cos((Math.PI * 2 * l) / hiltWavelength));
        return colorLerp(hiltColorDark, hiltColorLight, gripWave);
      },
    });
  }

  public drawHaftHelper(params: HaftParams): { radius: number } {
    this.rng.checkpoint();
    const r = this.rng;

    const minRadius = params.minRadius ? params.minRadius : 1;
    const maxRadius = params.maxRadius;
    // See drawGripHelper: incoming radii are already pixel-scaled, so no extra
    // `* dscale` (double-scaling made hafts fatten into cones at high res).
    const haftRadius = params.fractionalRadiusAllowed
      ? 0.5 * Math.ceil(r.range(minRadius * 2, maxRadius * 2))
      : Math.ceil(r.range(minRadius, maxRadius));

    const haftColor = params.color ?? hsvToRgb({ h: r.range(35, 45), s: r.float(), v: r.rangeFloat(0.5, 0.95) });

    this.drawRodHelper({
      radius: haftRadius,
      startDiag: params.startDiag,
      lengthDiag: params.lengthDiag,
      colorFunc: () => haftColor,
    });

    return { radius: haftRadius };
  }

  public drawRodHelper(params: RodParams): void {
    const radius = Math.max(1, params.radius);
    const bounds = new Bounds(0, 0, this.dimension, this.dimension);
    const radSteps = radius / 0.5;

    const startAxis = Math.ceil(params.startDiag / Math.sqrt(2));
    const lengthAxis = params.lengthDiag / Math.sqrt(2);
    for (let l = 0; l < lengthAxis; l += 0.5) {
      const al = startAxis + l;
      const core = new Vector(al, bounds.h - 1 - al);
      const fractionalStep = al % 1 !== 0;
      let left: number;
      let right: number;
      if (!fractionalStep) {
        left = -Math.floor((radSteps - 2) / 4);
        right = Math.floor((radSteps - 1) / 4);
      } else {
        core.x = Math.floor(core.x);
        core.y = Math.floor(core.y);
        left = -Math.floor((radSteps - 3) / 4);
        right = Math.floor((radSteps - 0) / 4);
      }

      const sliceColor = params.colorFunc(l);
      for (let h = left; h <= right; h++) {
        let darkenAmt: number;
        if (left === right) {
          darkenAmt = fractionalStep ? 0 : 1;
        } else {
          darkenAmt = (h - left) / (right - left);
        }
        darkenAmt *= 0.3;
        this.ctx.fillStyle = colorStr(colorDarken(sliceColor, darkenAmt));
        this.drawPixel(core.x + h, core.y + h);
      }
    }
  }

  // -- round ornament --------------------------------------------------------

  public drawRoundOrnamentHelper(params: OrnamentParams): void {
    this.rng.checkpoint();
    const r = this.rng;

    const pommelColorLight = params.colorLight ?? hsvToRgb({ h: r.range(0, 360), s: r.floatLow() * 0.5, v: r.rangeFloat(0.7, 1) });
    const pommelColorDark = params.colorDark ?? colorDarken(pommelColorLight, 0.6);
    const pommelRadius = params.radius;
    const shadowCenter = new Vector(0.5, 1).normalize().multiplyScalar(pommelRadius).addVector(params.center);
    const highlightCenter = new Vector(-1, -1).normalize().multiplyScalar(pommelRadius * 0.7).addVector(params.center);
    for (let x = Math.floor(params.center.x - pommelRadius); x <= Math.ceil(params.center.x + pommelRadius); x++) {
      for (let y = Math.floor(params.center.y - pommelRadius); y <= Math.ceil(params.center.y + pommelRadius); y++) {
        const radius = params.center.distanceTo(x, y);
        if (radius <= pommelRadius) {
          const shadowDist = shadowCenter.distanceTo(x, y);
          const highlightDist = highlightCenter.distanceTo(x, y);
          const darkAmt = 1 - Math.min(1, (0.8 * shadowDist) / pommelRadius);
          const lightAmt = 1 - Math.min(1, highlightDist / pommelRadius);
          this.ctx.fillStyle = colorStr(colorLighten(colorLerp(pommelColorLight, pommelColorDark, darkAmt), lightAmt));
          this.drawPixel(x, y);
        }
      }
    }
  }
}

// -- helper param/result shapes ----------------------------------------------

export interface BladeParams {
  startDiag: number;
  taperFactor: number;
  startRadius: number;
}
export interface BladeResults {
  startDiag: number;
  startOrtho: number;
  startRadius: number;
  hiltColor: Color;
  tipColor: Color;
}
export interface CrossguardParams {
  positionDiag: number;
  halfLength: number;
  omegaChance?: number;
  omegaAmount?: number;
  thickness?: number;
}
export interface CrossguardResults {
  colorLight: Color;
  colorDark: Color;
}
export interface GripParams {
  startDiag: number;
  lengthDiag: number;
  minRadius?: number;
  maxRadius: number;
  fractionalRadiusAllowed?: boolean;
}
export interface HaftParams {
  startDiag: number;
  lengthDiag: number;
  minRadius?: number;
  maxRadius: number;
  fractionalRadiusAllowed?: boolean;
  color?: Color;
}
export interface RodParams {
  radius: number;
  startDiag: number;
  lengthDiag: number;
  colorFunc: (l: number) => Color;
}
export interface OrnamentParams {
  center: Vector;
  radius: number;
  colorLight?: Color;
  colorDark?: Color;
}

/**
 * Convenience one-shot: draw an icon into a fresh context.
 * Returns the concrete class that was drawn (useful when `iconClass` was a
 * meta-selector like "anyweapon").
 */
