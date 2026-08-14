import { toNodeID } from './to-node-id';
import type { WorldEdge } from './types';

/**
 * Whether the cell at `(cx, cy)` owns `edge` for build-once purposes. `collectNodeEdges` returns
 * every edge incident to a cell, so a caller visiting many cells sees each edge from both
 * endpoints; deciding ownership by the sorted edge id lets exactly one of those two visits build
 * the edge's furniture, deck, or other per-edge geometry, with no shared coordination state
 * between cells. The cell whose node id leads the sorted id owns the edge.
 */
export function isEdgeOwner(cx: number, cy: number, edge: WorldEdge): boolean {
  return edge.id.startsWith(`${toNodeID(cx, cy)}|`);
}
