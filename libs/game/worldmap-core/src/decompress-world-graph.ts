import { buildWorldEdgesByID } from './build-world-edges-by-id';
import { buildWorldMapNodesByID } from './build-world-map-nodes-by-id';
import type { CompressedWorldMapNode, WorldGraph } from './types';

export function decompressWorldGraph(data: ReadonlyArray<CompressedWorldMapNode>): WorldGraph {
  const nodes = buildWorldMapNodesByID(data);

  return {
    edges: buildWorldEdgesByID(nodes),
    nodes,
  };
}
