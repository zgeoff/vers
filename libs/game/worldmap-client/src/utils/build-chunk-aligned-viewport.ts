import type { Viewport } from '@vers/worldmap-core';
import { CHUNK_SIZE, WORLD_COORD_MAX, WORLD_COORD_MIN } from '@vers/worldmap-core';

/**
 * Rounds a viewport out to the generation-chunk grid it overlaps, so a pan that stays inside the
 * same chunks keeps requesting the identical reveal-query viewport instead of a new one every cell.
 * Clamped back to the lattice's encodable range, since rounding outward can push past it near the
 * world's rim. An optional `cellCap` then shrinks the aligned box symmetrically around its center —
 * one chunk off each end of the longer axis at a time — until its cell area fits the cap, so a
 * pathological canvas aspect can never push a capped caller past its per-request bound; callers
 * aligning for geometry pass no cap.
 */
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
