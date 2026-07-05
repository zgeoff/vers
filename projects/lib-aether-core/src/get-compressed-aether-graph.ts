import type { AetherNode, CompressedAetherNode } from './types';

/**
 * converts an array of AetherNodes into an array of CompressedAetherNodes
 *
 * @param nodes - The AetherNodes to serialize.
 * @returns An array of CompressedAetherNodes.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function getCompressedAetherGraph(nodes: Array<AetherNode>): Array<CompressedAetherNode> {
  return nodes.map((node) => ({
    c: node.connections,
    d: node.difficulty,
    i: node.index,
    id: node.id,
    p: node.position,
    s: node.seed,
  }));
}
