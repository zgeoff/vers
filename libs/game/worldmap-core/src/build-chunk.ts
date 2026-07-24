import { buildCellNode } from './build-cell-node';
import { CHUNK_SIZE } from './consts';
import type { LatticeNode } from './types';

/**
 * Builds every node in a chunk — a `CHUNK_SIZE`×`CHUNK_SIZE` block of cells — straight from the
 * chunk coordinate, touching no neighbouring chunk. Nodes come in row-major cell order.
 */
export function buildChunk(userSeed: number, chunkX: number, chunkY: number): Array<LatticeNode> {
  const baseX = chunkX * CHUNK_SIZE;
  const baseY = chunkY * CHUNK_SIZE;
  const nodes: Array<LatticeNode> = [];

  for (let row = 0; row < CHUNK_SIZE; row++) {
    for (let col = 0; col < CHUNK_SIZE; col++) {
      nodes.push(buildCellNode(userSeed, baseX + col, baseY + row));
    }
  }

  return nodes;
}
