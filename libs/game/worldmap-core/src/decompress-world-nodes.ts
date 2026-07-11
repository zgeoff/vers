import { getWorldEdgeMap } from './get-world-edge-map';
import { getWorldNodeMap } from './get-world-node-map';
import type { CompressedWorldNode, WorldGraph } from './types';

export function decompressWorldNodes(data: ReadonlyArray<CompressedWorldNode>): WorldGraph {
  const nodes = getWorldNodeMap(data);

  return {
    edges: getWorldEdgeMap(nodes),
    nodes,
  };
}
