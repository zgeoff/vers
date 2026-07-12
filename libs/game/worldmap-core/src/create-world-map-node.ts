import { createSeed } from '@vers/game-utils';
import { createID } from './create-id';
import { getNodePosition } from './get-node-position';
import type { WorldMapNode } from './types';

export function createWorldMapNode(index: number, difficulty: number): WorldMapNode {
  return {
    connections: [null, null, null, null],
    difficulty,
    id: createID(),
    index,
    position: getNodePosition(index, difficulty),
    seed: createSeed(),
  };
}
