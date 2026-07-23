import { HASH_CHANNEL, buildCoordHashUnit } from './build-coord-hash';
import { JITTER } from './consts';
import { getDifficulty } from './get-difficulty';
import { toHexPosition } from './to-hex-position';
import { toNodeID } from './to-node-id';
import type { LatticeNode } from './types';

/**
 * Builds the single node a cell carries: its canonical id, jittered scene position, and difficulty.
 * Every cell holds a node — visible sparseness is a render choice, never an absence — so this never
 * returns null. Jitter is a pure function of the avatar seed and coordinate, so client and server
 * agree on the position without either storing it.
 */
export function buildCellNode(userSeed: number, cx: number, cy: number): LatticeNode {
  const [centerX, centerY] = toHexPosition(cx, cy);
  const offsetX = (buildCoordHashUnit(userSeed, cx, cy, HASH_CHANNEL.jitterX) - 0.5) * 2 * JITTER;
  const offsetY = (buildCoordHashUnit(userSeed, cx, cy, HASH_CHANNEL.jitterY) - 0.5) * 2 * JITTER;

  return {
    coord: [cx, cy],
    difficulty: getDifficulty(cx, cy),
    id: toNodeID(cx, cy),
    position: [centerX + offsetX, centerY + offsetY],
  };
}
