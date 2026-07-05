import { createRNG } from '@vers/game-utils';
import { getRandomizedPosition } from './get-randomized-position';
import type { AetherNode, AetherNodeMap, CompressedAetherNode } from './types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function getAetherNodeMap(compressedNodes: Array<CompressedAetherNode>): AetherNodeMap {
  const nodes: AetherNodeMap = {};

  for (const node of compressedNodes) {
    const rng = createRNG(node.s);

    const aetherNode: AetherNode = {
      connections: node.c,
      difficulty: node.d,
      id: node.id,
      index: node.i,
      position: getRandomizedPosition(node.p, rng),
      seed: node.s,
    };

    nodes[node.id] = aetherNode;
  }

  return nodes;
}
