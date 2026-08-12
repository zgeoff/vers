import { ORIGIN_CELL, REVEAL_RADIUS } from './consts';
import { findCellCoord } from './find-cell-coord';
import type { RevealSource } from './types';

/**
 * Builds the reveal sources a fog presentation projects from: one disc per addressable completed
 * node, plus the origin cell unconditionally — mirroring selectability, where the origin is always
 * available, so a fresh avatar sees its starting area instead of a fully fogged map. A completed id
 * that names no addressable cell contributes nothing, and a completed origin contributes no second
 * disc beside the unconditional one.
 */
export function buildRevealSources(
  completedNodeIDs: ReadonlySet<string>,
): ReadonlyArray<RevealSource> {
  const sources: Array<RevealSource> = [{ coord: ORIGIN_CELL, radius: REVEAL_RADIUS }];

  for (const nodeID of completedNodeIDs) {
    const coord = findCellCoord(nodeID);

    if (coord !== undefined && (coord[0] !== ORIGIN_CELL[0] || coord[1] !== ORIGIN_CELL[1])) {
      sources.push({ coord, radius: REVEAL_RADIUS });
    }
  }

  return sources;
}
