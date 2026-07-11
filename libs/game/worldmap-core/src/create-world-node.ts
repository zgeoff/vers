import { createSeed } from '@vers/game-utils';
import { createID } from './create-id';
import { getNodePosition } from './get-node-position';
import type { WorldNode } from './types';

export function createWorldNode(index: number, difficulty: number): WorldNode {
  return {
    connections: [null, null, null, null],
    difficulty,
    id: createID(),
    index,
    position: getNodePosition(index, difficulty),
    seed: createSeed(),
  };
}
