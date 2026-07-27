import type { Pen } from "../pen";
import { Vector, Bounds } from "../math";

export function drawBlade(pen: Pen): void {
  pen.rng.checkpoint();
  const r = pen.rng;

  const bounds = new Bounds(0, 0, pen.dimension, pen.dimension);
  const dscale = bounds.h / 32;

  pen.clearCanvas();

  const pommelLength = Math.ceil(r.floatLow() * 2 * dscale);
  const hiltLength = Math.ceil(r.range(6, 11) * dscale);
  const xguardWidth = Math.ceil(r.range(1, 4) * dscale);

  const bladeResults = pen.drawBladeHelper({
    startDiag: pommelLength + hiltLength + xguardWidth,
    taperFactor: r.floatLow(),
    startRadius: Math.ceil(r.range(2, 4) * dscale),
  });

  const hiltStartDiag = Math.floor(pommelLength * Math.sqrt(2));
  pen.drawGripHelper({
    startDiag: hiltStartDiag,
    lengthDiag: Math.floor(bladeResults.startOrtho - hiltStartDiag),
    maxRadius: bladeResults.startRadius,
    fractionalRadiusAllowed: false,
  });

  const crossguardResults = pen.drawCrossguardHelper({
    positionDiag: bladeResults.startOrtho,
    halfLength: bladeResults.startRadius * (1 + 2 * r.floatLow()) + 1,
  });

  const pommelRadius = (pommelLength * Math.sqrt(2)) / 2;
  pen.drawRoundOrnamentHelper({
    center: new Vector(Math.floor(pommelRadius + 1), Math.ceil(bounds.h - pommelRadius - 2)),
    radius: pommelRadius,
    colorLight: crossguardResults.colorLight,
    colorDark: crossguardResults.colorDark,
  });

  pen.addBorder();
}
