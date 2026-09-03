import { toNodeID } from './to-node-id';
import type { WorldEdge } from './types';

export function isEdgeOwner(cx: number, cy: number, edge: WorldEdge): boolean {
  return edge.id.startsWith(`${toNodeID(cx, cy)}|`);
}
