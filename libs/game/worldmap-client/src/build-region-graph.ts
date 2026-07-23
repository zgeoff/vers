import { buildCellNode, collectNodeEdges } from '@vers/worldmap-core';
import type { LatticeEdge, LatticeNode } from '@vers/worldmap-core';
import type { WorldGraph } from './types';

/**
 * Assembles a bounded slice of the lattice around the origin: every cell within `radius` rings, its
 * nodes and their edges keyed by id. An edge to a cell beyond the slice is dropped, so every
 * rendered edge lands on a rendered node.
 */
export function buildRegionGraph(userSeed: number, radius: number): WorldGraph {
  const nodes: Record<string, LatticeNode> = {};

  for (let cx = -radius; cx <= radius; cx++) {
    const lowCy = Math.max(-radius, -cx - radius);
    const highCy = Math.min(radius, -cx + radius);

    for (let cy = lowCy; cy <= highCy; cy++) {
      const node = buildCellNode(userSeed, cx, cy);

      nodes[node.id] = node;
    }
  }

  const edges: Record<string, LatticeEdge> = {};

  for (const node of Object.values(nodes)) {
    for (const edge of collectNodeEdges(userSeed, node.coord[0], node.coord[1])) {
      const [aID = '', bID = ''] = edge.id.split('|');

      if (nodes[aID] && nodes[bID]) {
        edges[edge.id] = edge;
      }
    }
  }

  return { edges, nodes };
}
