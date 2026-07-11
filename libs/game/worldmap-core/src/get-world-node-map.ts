import { createRNG } from '@vers/game-utils';
import { getRandomizedPosition } from './get-randomized-position';
import type { CompressedWorldNode, WorldNode, WorldNodeMap } from './types';

export function getWorldNodeMap(compressedNodes: ReadonlyArray<CompressedWorldNode>): WorldNodeMap {
  const nodes: Record<string, WorldNode> = {};

  for (const node of compressedNodes) {
    const rng = createRNG(node.s);

    const worldNode: WorldNode = {
      connections: node.c,
      difficulty: node.d,
      id: node.id,
      index: node.i,
      position: getRandomizedPosition(node.p, rng),
      seed: node.s,
    };

    nodes[node.id] = worldNode;
  }

  return nodes;
}
