import type { CompressedWorldNode, WorldNode } from './types';

/**
 * converts an array of WorldNodes into an array of CompressedWorldNodes
 *
 * @param nodes - The WorldNodes to serialize.
 * @returns An array of CompressedWorldNodes.
 */
export function getCompressedWorldGraph(
  nodes: ReadonlyArray<WorldNode>,
): Array<CompressedWorldNode> {
  return nodes.map((node) => ({
    c: node.connections,
    d: node.difficulty,
    i: node.index,
    id: node.id,
    p: node.position,
    s: node.seed,
  }));
}
