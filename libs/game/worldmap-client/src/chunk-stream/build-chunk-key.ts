export function buildChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX}_${chunkY}`;
}
