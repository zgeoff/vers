import type { Viewport } from '@vers/worldmap-core';
import { CHUNK_SIZE, WORLD_COORD_MAX, WORLD_COORD_MIN } from '@vers/worldmap-core';

export function buildChunkAlignedViewport(viewport: Viewport, cellCap?: number): Viewport {
  let minCX = Math.max(WORLD_COORD_MIN, Math.floor(viewport.minCX / CHUNK_SIZE) * CHUNK_SIZE);

  let maxCX = Math.min(
    WORLD_COORD_MAX,
    Math.floor(viewport.maxCX / CHUNK_SIZE) * CHUNK_SIZE + CHUNK_SIZE - 1,
  );

  let minCY = Math.max(WORLD_COORD_MIN, Math.floor(viewport.minCY / CHUNK_SIZE) * CHUNK_SIZE);

  let maxCY = Math.min(
    WORLD_COORD_MAX,
    Math.floor(viewport.maxCY / CHUNK_SIZE) * CHUNK_SIZE + CHUNK_SIZE - 1,
  );

  if (cellCap === undefined) {
    return { maxCX, maxCY, minCX, minCY };
  }

  // a span shrinks only while a chunk off each end still leaves it at least one chunk wide, which
  // bounds the loop no matter how small a cap a caller hands in
  while (
    (maxCX - minCX + 1) * (maxCY - minCY + 1) > cellCap &&
    (canShrinkSpan(minCX, maxCX) || canShrinkSpan(minCY, maxCY))
  ) {
    if (maxCX - minCX >= maxCY - minCY && canShrinkSpan(minCX, maxCX)) {
      minCX += CHUNK_SIZE;
      maxCX -= CHUNK_SIZE;
    } else {
      minCY += CHUNK_SIZE;
      maxCY -= CHUNK_SIZE;
    }
  }

  return { maxCX, maxCY, minCX, minCY };
}

function canShrinkSpan(min: number, max: number): boolean {
  return max - min + 1 > 2 * CHUNK_SIZE;
}
