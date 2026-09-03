import { HASH_CHANNEL, buildCoordHashUnit } from './build-coord-hash';
import { JITTER } from './consts';
import { getDifficulty } from './get-difficulty';
import { toHexPosition } from './to-hex-position';
import { toNodeID } from './to-node-id';
import type { WorldMapNode } from './types';

export function buildCellNode(userSeed: number, cx: number, cy: number): WorldMapNode {
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
