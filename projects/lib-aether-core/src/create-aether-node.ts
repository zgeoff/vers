import { createSeed } from '@vers/game-utils';
import { createID } from './create-id';
import { getNodePosition } from './get-node-position';
import type { AetherNode } from './types';

export function createAetherNode(index: number, difficulty: number): AetherNode {
  return {
    connections: [null, null, null, null],
    difficulty,
    id: createID(),
    index,
    position: getNodePosition(index, difficulty),
    seed: createSeed(),
  };
}
