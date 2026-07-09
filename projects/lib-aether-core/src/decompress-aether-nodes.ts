import { getAetherEdgeMap } from './get-aether-edge-map';
import { getAetherNodeMap } from './get-aether-node-map';
import type { AetherGraph, CompressedAetherNode } from './types';

export function decompressAetherNodes(data: ReadonlyArray<CompressedAetherNode>): AetherGraph {
  const nodes = getAetherNodeMap(data);

  return {
    edges: getAetherEdgeMap(nodes),
    nodes,
  };
}
