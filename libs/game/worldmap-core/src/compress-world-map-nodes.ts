import type { CompressedWorldMapNode, WorldMapNode } from './types';

/**
 * converts an array of WorldMapNodes into an array of CompressedWorldMapNodes
 *
 * @param nodes - The WorldMapNodes to serialize.
 * @returns An array of CompressedWorldMapNodes.
 */
export function compressWorldMapNodes(
  nodes: ReadonlyArray<WorldMapNode>,
): Array<CompressedWorldMapNode> {
  return nodes.map((node) => ({
    c: node.connections,
    d: node.difficulty,
    i: node.index,
    id: node.id,
    p: node.position,
    s: node.seed,
  }));
}
