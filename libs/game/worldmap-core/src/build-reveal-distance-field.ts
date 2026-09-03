import { JITTER } from './consts';
import { toHexPosition } from './to-hex-position';
import type { RevealDistanceField, RevealSource, Viewport } from './types';

const SQRT_3 = Math.sqrt(3);
const JITTER_MARGIN = JITTER * Math.SQRT2;

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
  for (let j = 0; j < rows; j++) {
    const b = viewport.minCY - 0.5 + (j + 0.5) / options.resolution;

    for (let i = 0; i < cols; i++) {
      const a = viewport.minCX - 0.5 + (i + 0.5) / options.resolution;
      const [x, y] = toHexPosition(a, b);
      let distance = Number.POSITIVE_INFINITY;

      for (const disc of discs) {
        const d = Math.hypot(x - disc.x, y - disc.y) - disc.clearRadius;

        if (d < distance) {
          distance = d;
        }
      }

      const t = Math.min(Math.max(distance / options.falloff, 0), 1);

      values[j * cols + i] = t * t * t * (t * (t * 6 - 15) + 10);
    }
  }

  return { cols, rows, values };
}

interface ReachingDisc {
  readonly clearRadius: number;
  readonly x: number;
  readonly y: number;
}

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
