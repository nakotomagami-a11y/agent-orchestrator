// Draws one 64×64 path tile using PixiJS Graphics so we need no external PNG.
// n/e/s/w = whether that cardinal neighbour is also a path cell.
import { Graphics } from "pixi.js";
import { PATH_B, PATH_C_BORDER, PATH_C_FILL, PATH_C_LIGHT, PATH_M, PATH_P } from "./constants";

export function drawPathGraphics(n: boolean, e: boolean, s: boolean, w: boolean): Graphics {
  const g = new Graphics();
  const M = PATH_M;
  const P = PATH_P;
  const B = PATH_B;

  // 1. Border (dark) — slightly expanded rects drawn first, fill on top reveals the ring
  g.rect(M - B, M - B, P + 2 * B, P + 2 * B);
  if (n) g.rect(M - B, 0,         P + 2 * B, M + B);
  if (s) g.rect(M - B, M + P - B, P + 2 * B, M + B);
  if (e) g.rect(M + P - B, M - B, M + B,     P + 2 * B);
  if (w) g.rect(0,         M - B, M + B,     P + 2 * B);
  g.fill({ color: PATH_C_BORDER });

  // 2. Main fill (earthy tan)
  g.rect(M, M, P, P);
  if (n) g.rect(M, 0,     P, M);
  if (s) g.rect(M, M + P, P, M);
  if (e) g.rect(M + P, M, M, P);
  if (w) g.rect(0, M,     M, P);
  g.fill({ color: PATH_C_FILL });

  // 3. Centre highlight strip — lighter 12px band along the middle of the path band
  const HL = 12;
  const HO = M + (P - HL) / 2; // offset from tile edge to highlight start
  g.rect(HO, HO, HL, HL);
  if (n) g.rect(HO, B,        HL, HO - B);
  if (s) g.rect(HO, M + P,    HL, M - B);
  if (e) g.rect(M + P, HO,    M - B, HL);
  if (w) g.rect(B,     HO,    HO - B, HL);
  g.fill({ color: PATH_C_LIGHT });

  return g;
}
