import type { Pen } from "../pen";
import type { CrossguardResults, HaftParams, OrnamentParams } from "../pen";
import { Vector, Bounds, diagToPosition } from "../math";
import { hsvToRgb } from "../color";

export function drawSpear(pen: Pen): void {
  pen.rng.checkpoint();
  const r = pen.rng;

  const bounds = new Bounds(0, 0, pen.dimension, pen.dimension);
  const canvasDiag = Math.sqrt(bounds.w * bounds.w + bounds.h * bounds.h);
  const dscale = bounds.h / 32;

  pen.clearCanvas();

  const gripLengthMin = 8;
  const tipLength = Math.ceil(r.range(10, 20) * dscale);
  const tipStartDiag = canvasDiag - tipLength;
  const gripStartDiag = Math.ceil(r.range(0, tipStartDiag - gripLengthMin));
  // The upper bound is already in canvas-diagonal units (scales with the
  // dimension), so only the literal `gripLengthMin` gets `* dscale` — the
  // original port multiplied the whole range by dscale, which made the grip
  // grow quadratically and swallow the shaft at high render resolutions.
  const gripLength = Math.ceil(r.range(gripLengthMin * dscale, tipStartDiag - gripStartDiag));

  const tipResults = pen.drawBladeHelper({
    startDiag: tipStartDiag,
    taperFactor: r.float() * 0.5 + 0.5,
    startRadius: Math.ceil(r.range(1, 2) * dscale),
  });

  const haftParams: HaftParams = {
    startDiag: 0,
    lengthDiag: tipStartDiag,
    maxRadius: tipResults.startRadius * 2,
    fractionalRadiusAllowed: true,
  };
  if (r.float() > 0.95) haftParams.color = tipResults.hiltColor;
  const haftResults = pen.drawHaftHelper(haftParams);

  if (r.float() > 0.65) {
    pen.drawGripHelper({
      startDiag: gripStartDiag,
      lengthDiag: gripLength / Math.sqrt(2),
      minRadius: haftResults.radius,
      maxRadius: haftResults.radius,
      fractionalRadiusAllowed: true,
    });
  }

  let crossguardResults: CrossguardResults | undefined;
  if (r.float() > 0.4) {
    crossguardResults = pen.drawCrossguardHelper({
      positionDiag: tipResults.startOrtho,
      halfLength: tipResults.startRadius * (1 + 8 * r.floatExtreme()) + 4,
      omegaChance: 0.4,
      omegaAmount: Math.PI / 10,
      thickness: r.rangeFloat(1, 2),
    });
  }

  // ribbons: original loops but the body is a TODO — kept for RNG parity.
  const ribbonCount = r.rangeLow(0, 4);
  for (let i = 0; i < ribbonCount; i++) {
    // no-op (matches source)
  }

  if (r.float() > 0.4) {
    const pommelRadius = Math.ceil((0.5 + r.floatLow() * 0.5) * dscale);
    const pommelParams: OrnamentParams = {
      center: new Vector(Math.floor(pommelRadius), Math.ceil(bounds.h - pommelRadius - 1)),
      radius: pommelRadius,
    };
    if (crossguardResults && r.float() > 0.5) {
      pommelParams.colorLight = crossguardResults.colorLight;
      pommelParams.colorDark = crossguardResults.colorDark;
    } else {
      pommelParams.colorLight = hsvToRgb({ h: r.range(0, 360), s: r.float(), v: r.rangeFloat(0, 1) });
    }
    // erase haft that might go below pommel
    pen.ctx.clearRect(-1, bounds.h, pommelRadius + 1, -(pommelRadius + 1));
    pen.drawRoundOrnamentHelper(pommelParams);
  }

  if (r.float() > 0.55) {
    const deviceRadius = Math.ceil((0.5 + r.floatLow() * 1.5) * dscale);
    const deviceParams: OrnamentParams = {
      center: diagToPosition(haftParams.startDiag + haftParams.lengthDiag - Math.floor(deviceRadius / 2), bounds),
      radius: deviceRadius,
    };
    if (crossguardResults && r.float() > 0.4) {
      deviceParams.colorLight = crossguardResults.colorLight;
      deviceParams.colorDark = crossguardResults.colorDark;
    } else {
      deviceParams.colorLight = hsvToRgb({ h: r.range(0, 360), s: r.float(), v: r.rangeFloat(0, 1) });
    }
    pen.drawRoundOrnamentHelper(deviceParams);
  }

  pen.addBorder();
}
