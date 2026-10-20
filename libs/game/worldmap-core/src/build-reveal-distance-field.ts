import { JITTER } from './consts';
import { toHexPosition } from './to-hex-position';
import type { RevealDistanceField, RevealSource, Viewport } from './types';

export interface RevealFieldOptions {
  readonly falloff: number;

  readonly resolution: number;
}

export function buildRevealDistanceField(
  sources: ReadonlyArray<RevealSource>,
  viewport: Readonly<Viewport>,
  options: Readonly<RevealFieldOptions>,
): RevealDistanceField {
  const cols = (viewport.maxCX - viewport.minCX + 1) * options.resolution;
  const rows = (viewport.maxCY - viewport.minCY + 1) * options.resolution;

  const values = new Float32Array(cols * rows);

  const discs = collectReachingDiscs(sources, viewport, options.falloff);

  // texels sample the cell box inflated by half a cell on each side, the mapping a quad spanning
  // that box with corner-anchored uvs interpolates
  for (let row = 0; row < rows; row++) {
    const cellY = viewport.minCY - 0.5 + (row + 0.5) / options.resolution;

    for (let column = 0; column < cols; column++) {
      const cellX = viewport.minCX - 0.5 + (column + 0.5) / options.resolution;
      const [x, y] = toHexPosition(cellX, cellY);
      let distance = Number.POSITIVE_INFINITY;

      for (const disc of discs) {
        const discDistance = Math.hypot(x - disc.x, y - disc.y) - disc.clearRadius;

        if (discDistance < distance) {
          distance = discDistance;
        }
      }

      const ramp = Math.min(Math.max(distance / options.falloff, 0), 1);

      values[row * cols + column] = ramp * ramp * ramp * (ramp * (ramp * 6 - 15) + 10);
    }
  }

  return { cols, rows, values };
}

interface ReachingDisc {
  readonly clearRadius: number;
  readonly x: number;
  readonly y: number;
}

const SQRT_3 = Math.sqrt(3);
const JITTER_MARGIN = JITTER * Math.SQRT2;

function collectReachingDiscs(
  sources: ReadonlyArray<RevealSource>,
  viewport: Readonly<Viewport>,
  falloff: number,
): ReadonlyArray<ReachingDisc> {
  const discs: Array<ReachingDisc> = [];

  for (const source of sources) {
    const clearRadius = source.radius * SQRT_3 + JITTER_MARGIN;
    const margin = Math.ceil((clearRadius + falloff) / 1.5) + 1;

    if (
      source.coord[0] < viewport.minCX - margin ||
      source.coord[0] > viewport.maxCX + margin ||
      source.coord[1] < viewport.minCY - margin ||
      source.coord[1] > viewport.maxCY + margin
    ) {
      continue;
    }

    const [x, y] = toHexPosition(source.coord[0], source.coord[1]);

    discs.push({ clearRadius, x, y });
  }

  return discs;
}
