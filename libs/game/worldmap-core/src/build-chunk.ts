import { buildCellNode } from './build-cell-node';
import { CHUNK_SIZE } from './consts';
import type { WorldMapNode } from './types';

export function buildChunk(userSeed: number, chunkX: number, chunkY: number): Array<WorldMapNode> {
  const baseX = chunkX * CHUNK_SIZE;
  const baseY = chunkY * CHUNK_SIZE;
  const nodes: Array<WorldMapNode> = [];

  for (let row = 0; row < CHUNK_SIZE; row++) {
    for (let col = 0; col < CHUNK_SIZE; col++) {
      nodes.push(buildCellNode(userSeed, baseX + col, baseY + row));
    }
  }

  return nodes;
}
