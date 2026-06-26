/**
 * Palettes for the Gas Giant planet type.
 *
 * A gas giant uses two stacked cloud layers (dark base + lighter overlay).
 * Each palette entry therefore has exactly 2 inner arrays — one per layer.
 * Each layer needs 4 colors (dark → light, used by the gas shader's `colors[4]`).
 */
import type { PaletteDef } from "./types";

const palettes: PaletteDef[] = [
  {
    name: "Jupiter",
    layers: [
      // Dark banded layer — warm terracotta shadows
      [[0.231, 0.125, 0.153], [0.231, 0.125, 0.153], [0.000, 0.000, 0.000], [0.129, 0.094, 0.106]],
      // Light cloud layer — golden ochres (original GasPlanet.tscn colors)
      [[0.941, 0.710, 0.255], [0.812, 0.459, 0.169], [0.671, 0.318, 0.188], [0.490, 0.220, 0.200]],
    ],
  },
  {
    name: "Neptune",
    layers: [
      [[0.06, 0.12, 0.38], [0.12, 0.22, 0.52], [0.20, 0.36, 0.60], [0.04, 0.08, 0.26]],
      [[0.36, 0.58, 0.80], [0.50, 0.70, 0.90], [0.26, 0.48, 0.68], [0.14, 0.30, 0.52]],
    ],
  },
  {
    name: "Nebula",
    layers: [
      [[0.28, 0.06, 0.38], [0.42, 0.12, 0.52], [0.18, 0.04, 0.28], [0.10, 0.02, 0.18]],
      [[0.70, 0.40, 0.78], [0.84, 0.54, 0.88], [0.52, 0.26, 0.62], [0.32, 0.14, 0.42]],
    ],
  },
  {
    name: "Ember",
    layers: [
      [[0.38, 0.06, 0.02], [0.52, 0.14, 0.04], [0.26, 0.04, 0.02], [0.14, 0.02, 0.01]],
      [[0.80, 0.32, 0.06], [0.90, 0.50, 0.12], [0.68, 0.22, 0.04], [0.48, 0.14, 0.02]],
    ],
  },
  {
    name: "Acid",
    layers: [
      [[0.12, 0.22, 0.04], [0.20, 0.36, 0.06], [0.08, 0.16, 0.02], [0.04, 0.08, 0.01]],
      [[0.52, 0.72, 0.12], [0.68, 0.86, 0.20], [0.40, 0.58, 0.08], [0.26, 0.40, 0.04]],
    ],
  },
  {
    name: "Storm",
    layers: [
      [[0.15, 0.18, 0.28], [0.22, 0.26, 0.40], [0.10, 0.12, 0.20], [0.06, 0.08, 0.12]],
      [[0.42, 0.52, 0.72], [0.56, 0.66, 0.84], [0.30, 0.40, 0.58], [0.18, 0.26, 0.40]],
    ],
  },
];

export default palettes;
