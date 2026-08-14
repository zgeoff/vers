/**
 * Encodes a chunk coordinate as the cache key `ChunkCache` stores it under. Reversed by
 * `parseChunkKey`.
 */
export function buildChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX}_${chunkY}`;
}
