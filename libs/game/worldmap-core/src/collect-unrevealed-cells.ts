import { canEncodeMortonKey } from './can-encode-morton-key';
import { encodeMortonKey } from './encode-morton-key';
import type { RevealedCells, Viewport } from './types';

/**
 * Collects every viewport cell absent from the revealed set — the region a fog presentation
 * covers. Cells outside the packable coordinate range carry no key and are skipped.
 */
export function collectUnrevealedCells(
  revealedCells: RevealedCells,
  viewport: Readonly<Viewport>,
): ReadonlyArray<readonly [number, number]> {
  const revealed = new Set(revealedCells);

  const cells: Array<readonly [number, number]> = [];

  for (let cx = viewport.minCX; cx <= viewport.maxCX; cx++) {
    for (let cy = viewport.minCY; cy <= viewport.maxCY; cy++) {
      if (canEncodeMortonKey([cx, cy]) && !revealed.has(encodeMortonKey([cx, cy]))) {
        cells.push([cx, cy]);
      }
    }
  }

  return cells;
}
