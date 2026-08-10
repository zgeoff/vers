import { canEncodeMortonKey } from './can-encode-morton-key';
import { encodeMortonKey } from './encode-morton-key';
import { getHexDistance } from './get-hex-distance';
import type { RevealSource, RevealedCells, Viewport } from './types';

/**
 * Projects a set of reveal sources onto the region a viewport actually asks for: for each source,
 * the hex disc of its own radius around its coordinate, clipped to the viewport and to the source's
 * own bounding box, deduplicated across overlapping sources, and returned Morton-sorted. A source
 * whose disc cannot reach the viewport at all — its coordinate falls outside the viewport inflated
 * by its own radius — contributes nothing, so the security constraint holds structurally: only
 * cells inside the union of source discs can appear, and the viewport can only narrow that union,
 * never widen it.
 *
 * A disc around a source near the edge of the packable coordinate range reaches cells no Morton key
 * can address; those cells are dropped, so a source stays usable right up to the edge.
 */
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
