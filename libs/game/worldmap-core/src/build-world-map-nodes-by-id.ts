import { buildStateFromSeed, createRNG } from '@vers/game-utils';
import { getRandomizedPosition } from './get-randomized-position';
import type { CompressedWorldMapNode, WorldMapNode, WorldMapNodesByID } from './types';

export function buildWorldMapNodesByID(
  compressedNodes: ReadonlyArray<CompressedWorldMapNode>,
): WorldMapNodesByID {
  const nodes: Record<string, WorldMapNode> = {};

  for (const node of compressedNodes) {
    const rng = createRNG(buildStateFromSeed(node.s));

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
