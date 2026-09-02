import { canEncodeMortonKey } from './can-encode-morton-key';
import { encodeMortonKey } from './encode-morton-key';
import { getHexDistance } from './get-hex-distance';
import type { RevealSource, RevealedCells, Viewport } from './types';

export function collectRevealedCells(
  sources: ReadonlyArray<RevealSource>,
  viewport: Readonly<Viewport>,
): RevealedCells {
  const keys = new Set<number>();

  for (const source of sources) {
    const minCX = Math.max(viewport.minCX, source.coord[0] - source.radius);
    const maxCX = Math.min(viewport.maxCX, source.coord[0] + source.radius);
    const minCY = Math.max(viewport.minCY, source.coord[1] - source.radius);
    const maxCY = Math.min(viewport.maxCY, source.coord[1] + source.radius);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        if (
          canEncodeMortonKey([cx, cy]) &&
          getHexDistance(source.coord, [cx, cy]) <= source.radius
        ) {
          keys.add(encodeMortonKey([cx, cy]));
        }
      }
    }
  }

  return [...keys].toSorted((a, b) => a - b);
}
