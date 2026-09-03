import { findCellCoord } from './find-cell-coord';
import { getHexDistance } from './get-hex-distance';
import type { RevealSource } from './types';

export function isNodeRevealed(sources: ReadonlyArray<RevealSource>, targetID: string): boolean {
  const coord = findCellCoord(targetID);

  if (coord === undefined) {
    return false;
  }

  return sources.some((source) => getHexDistance(source.coord, coord) <= source.radius);
}
