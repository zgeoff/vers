import { canEncodeMortonKey } from './can-encode-morton-key';
import { ORIGIN_CELL, REVEAL_RADIUS } from './consts';
import { findCellCoord } from './find-cell-coord';
import type { RevealSource } from './types';

export function buildRevealSources(
  completedNodeIDs: ReadonlySet<string>,
): ReadonlyArray<RevealSource> {
  const sources: Array<RevealSource> = [{ coord: ORIGIN_CELL, radius: REVEAL_RADIUS }];

  for (const nodeID of completedNodeIDs) {
    const coord = findCellCoord(nodeID);

    if (
      coord !== undefined &&
      canEncodeMortonKey(coord) &&
      (coord[0] !== ORIGIN_CELL[0] || coord[1] !== ORIGIN_CELL[1])
    ) {
      sources.push({ coord, radius: REVEAL_RADIUS });
    }
  }

  return sources;
}
