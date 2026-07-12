import { createRNG, stateFromSeed } from '@vers/game-utils';
import { getRandomizedPosition } from './get-randomized-position';
import type { CompressedWorldMapNode, WorldMapNode, WorldMapNodeMap } from './types';

export function getWorldMapNodeMap(
  compressedNodes: ReadonlyArray<CompressedWorldMapNode>,
): WorldMapNodeMap {
  const nodes: Record<string, WorldMapNode> = {};

  for (const node of compressedNodes) {
    const rng = createRNG(stateFromSeed(node.s));

    const worldMapNode: WorldMapNode = {
      connections: node.c,
      difficulty: node.d,
      id: node.id,
      index: node.i,
      position: getRandomizedPosition(node.p, rng),
      seed: node.s,
    };

    nodes[node.id] = worldMapNode;
  }

  return nodes;
}
