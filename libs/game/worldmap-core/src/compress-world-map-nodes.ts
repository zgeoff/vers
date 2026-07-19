import type { CompressedWorldMapNode, WorldMapNode } from './types';

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
