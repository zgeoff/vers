import { JITTER } from './consts';
import { toHexPosition } from './to-hex-position';
import type { RevealDistanceField, RevealSource, Viewport } from './types';

const SQRT_3 = Math.sqrt(3);

/**
 * Scene-space pad added to every disc's clear radius: node placement jitters each cell center by
 * up to the per-axis jitter bound, so without the pad a rim node jittered outward would poke into
 * the fog gradient.
 */
const JITTER_MARGIN = JITTER * Math.SQRT2;

export interface RevealFieldOptions {
  /**
   * Scene-space distance beyond a disc's clear radius over which density eases from 0 to 1.
   */
  readonly falloff: number;

  /**
   * Texels per axial cell unit. Higher resolves rounder contours; 1 degrades to one sample per
   * cell.
   */
  readonly resolution: number;
}

/**
 * Builds the fog-density field a soft fog presentation samples: the euclidean signed distance from
 * each texel to the union of the reveal-source discs, smootherstep-eased so revealed ground reads
 * 0 and anything a falloff past the nearest disc edge reads 1. Distances are measured in unit-hex
 * scene space, so contours are round rather than tracing the hex lattice.
 *
 * A disc's clear radius is its hex-hop radius times √3 — the farthest scene distance of any cell
 * inside its hex disc — plus the jitter margin, so every genuinely revealed cell sits fully inside
 * the clear region even when its node is jittered outward, and fog never hides opened ground.
 */
export function buildRevealDistanceField(
  sources: ReadonlyArray<RevealSource>,
  viewport: Readonly<Viewport>,
  options: Readonly<RevealFieldOptions>,
): RevealDistanceField {
  const cols = (viewport.maxCX - viewport.minCX + 1) * options.resolution;
  const rows = (viewport.maxCY - viewport.minCY + 1) * options.resolution;

  const values = new Float32Array(cols * rows);

  const discs = collectReachingDiscs(sources, viewport, options.falloff);

  // Texels are laid out row-major over the viewport's cell box inflated by half a cell on each
  // side: texel (i, j) samples axial (minCX - 0.5 + (i + 0.5) / resolution, minCY - 0.5 + (j +
  // 0.5) / resolution), the same mapping a quad spanning that box with corner-anchored uvs
  // interpolates.
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

/**
 * Culls the source list to discs whose fog gradient can reach the viewport at all, so the per-texel
 * scan stays proportional to nearby sources rather than every node the avatar ever completed. The
 * margin is conservative: a Chebyshev axial step moves at least 1.5 scene units, so a box this wide
 * contains every disc within scene reach.
 */
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
