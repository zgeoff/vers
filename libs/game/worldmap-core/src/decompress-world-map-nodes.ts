import { getWorldEdgeMap } from './get-world-edge-map';
import { getWorldMapNodeMap } from './get-world-map-node-map';
import type { CompressedWorldMapNode, WorldGraph } from './types';

export function decompressWorldMapNodes(data: ReadonlyArray<CompressedWorldMapNode>): WorldGraph {
  const nodes = getWorldMapNodeMap(data);

  return {
    edges: getWorldEdgeMap(nodes),
    nodes,
  };
}
