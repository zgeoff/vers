import { getAetherEdgeMap } from './get-aether-edge-map';
import { getAetherNodeMap } from './get-aether-node-map';
import type { AetherGraph, CompressedAetherNode } from './types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function decompressAetherNodes(data: Array<CompressedAetherNode>): AetherGraph {
  const nodes = getAetherNodeMap(data);

  return {
    edges: getAetherEdgeMap(nodes),
    nodes,
  };
}
