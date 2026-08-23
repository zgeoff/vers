import { findCellCoord } from './find-cell-coord';
import { getHexDistance } from './get-hex-distance';
import type { RevealSource } from './types';

/**
 * Whether `targetID` falls inside the union of `sources`' hex discs — the same projection
 * `collectRevealedCells` rasterizes for a viewport, evaluated one target at a time and unbounded by
 * any viewport, so a server authorizing a single node and a client rendering fog agree on every
 * coordinate. Callers build the sources from the avatar's verified first-clear set, which fixes
 * reveal to what verification has earned. An id `findCellCoord` can't address is never revealed.
 */
export function isNodeRevealed(sources: ReadonlyArray<RevealSource>, targetID: string): boolean {
  const coord = findCellCoord(targetID);

  if (coord === undefined) {
    return false;
  }

  return sources.some((source) => getHexDistance(source.coord, coord) <= source.radius);
}
