import { canEncodeMortonKey } from './can-encode-morton-key';
import { encodeMortonKey } from './encode-morton-key';
import type { RevealDistanceField, RevealedCells, Viewport } from './types';

const AXIAL_NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

/**
 * Builds the fog-density field a soft fog presentation samples: per viewport cell, the hex-hop
 * distance to the nearest revealed cell, smoothstep-eased and normalised so revealed ground reads
 * 0 and anything `falloff` or more hops out reads 1.
 *
 * Distances propagate only from revealed cells inside the viewport, so callers must compute
 * `revealedCells` over the viewport inflated by at least `falloff` cells — otherwise a revealed
 * cell just outside a tightly clipped set stops softening the cells it borders and the fog
 * hardens at the viewport edge.
 */
export function buildRevealDistanceField(
  revealedCells: RevealedCells,
  viewport: Readonly<Viewport>,
  falloff: number,
): RevealDistanceField {
  const cols = viewport.maxCX - viewport.minCX + 1;
  const rows = viewport.maxCY - viewport.minCY + 1;

  const distances = new Float32Array(cols * rows).fill(falloff);
  const revealed = new Set(revealedCells);

  let frontier: Array<readonly [number, number]> = [];

  for (let cy = viewport.minCY; cy <= viewport.maxCY; cy++) {
    for (let cx = viewport.minCX; cx <= viewport.maxCX; cx++) {
      if (canEncodeMortonKey([cx, cy]) && revealed.has(encodeMortonKey([cx, cy]))) {
        distances[(cy - viewport.minCY) * cols + (cx - viewport.minCX)] = 0;

        frontier.push([cx, cy]);
      }
    }
  }

  for (let distance = 1; distance < falloff && frontier.length > 0; distance++) {
    const next: Array<readonly [number, number]> = [];

    for (const [cx, cy] of frontier) {
      for (const [dcx, dcy] of AXIAL_NEIGHBOURS) {
        const nx = cx + dcx;
        const ny = cy + dcy;

        if (
          nx < viewport.minCX ||
          nx > viewport.maxCX ||
          ny < viewport.minCY ||
          ny > viewport.maxCY
        ) {
          continue;
        }

        const index = (ny - viewport.minCY) * cols + (nx - viewport.minCX);
        const current = distances[index] ?? 0;

        if (current > distance) {
          distances[index] = distance;

          next.push([nx, ny]);
        }
      }
    }

    frontier = next;
  }

  const values = new Float32Array(cols * rows);

  for (let index = 0; index < values.length; index++) {
    const t = (distances[index] ?? falloff) / falloff;

    values[index] = t * t * (3 - 2 * t);
  }

  return { cols, rows, values };
}
