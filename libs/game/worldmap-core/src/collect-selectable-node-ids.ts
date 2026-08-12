import { collectNodeEdges } from './collect-node-edges';
import { ORIGIN_CELL } from './consts';
import { findCellCoord } from './find-cell-coord';
import { findEdgeNeighbourID } from './find-edge-neighbour-id';
import { toNodeID } from './to-node-id';

/**
 * Collects the avatar's full selectable-node set: the origin cell, every completed node, and every
 * node directly connected to a completed node by an edge — the same rule `isNodeSelectable`
 * evaluates one target at a time, expanded here to the whole set by walking `collectNodeEdges` once
 * per completed node against the full topology rather than testing every node in a rendered region.
 * The origin joins the result unconditionally but is never itself an expansion source: an
 * uncompleted origin makes only the origin selectable, not its neighbours.
 */
export function collectSelectableNodeIDs(
  userSeed: number,
  completedNodeIDs: ReadonlySet<string>,
): ReadonlySet<string> {
  const selectable = new Set<string>([
    ...completedNodeIDs,
    toNodeID(ORIGIN_CELL[0], ORIGIN_CELL[1]),
  ]);

  for (const nodeID of completedNodeIDs) {
    const coord = findCellCoord(nodeID);

    if (coord === undefined) {
      continue;
    }

    for (const edge of collectNodeEdges(userSeed, coord[0], coord[1])) {
      const neighbourID = findEdgeNeighbourID(edge, nodeID);

      if (neighbourID !== undefined) {
        selectable.add(neighbourID);
      }
    }
  }

  return selectable;
}
