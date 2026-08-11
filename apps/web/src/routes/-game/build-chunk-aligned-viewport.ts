import type { Viewport } from '@vers/worldmap-core';
import { CHUNK_SIZE, WORLD_COORD_MAX, WORLD_COORD_MIN } from '@vers/worldmap-core';

/**
 * Rounds a viewport out to the generation-chunk grid it overlaps, so a pan that stays inside the
 * same chunks keeps requesting the identical reveal-query viewport instead of a new one every cell.
 * Clamped back to the lattice's encodable range, since rounding outward can push past it near the
 * world's rim.
 */
export function buildChunkAlignedViewport(viewport: Viewport): Viewport {
  return {
    maxCX: Math.min(
      WORLD_COORD_MAX,
      Math.floor(viewport.maxCX / CHUNK_SIZE) * CHUNK_SIZE + CHUNK_SIZE - 1,
    ),
    maxCY: Math.min(
      WORLD_COORD_MAX,
      Math.floor(viewport.maxCY / CHUNK_SIZE) * CHUNK_SIZE + CHUNK_SIZE - 1,
    ),
    minCX: Math.max(WORLD_COORD_MIN, Math.floor(viewport.minCX / CHUNK_SIZE) * CHUNK_SIZE),
    minCY: Math.max(WORLD_COORD_MIN, Math.floor(viewport.minCY / CHUNK_SIZE) * CHUNK_SIZE),
  };
}
