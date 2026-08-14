import invariant from 'tiny-invariant';

/**
 * Recovers the chunk coordinate `buildChunkKey` encoded. The cache never mints a key any other
 * way, so a key that fails to parse back into two integers can only mean the cache holds a key this
 * module didn't write.
 */
export function parseChunkKey(key: string): readonly [chunkX: number, chunkY: number] {
  const [rawX, rawY] = key.split('_');
  const chunkX = Number(rawX);
  const chunkY = Number(rawY);

  invariant(
    rawX !== undefined &&
      rawY !== undefined &&
      Number.isInteger(chunkX) &&
      Number.isInteger(chunkY),
    'a chunk key always encodes two integer coordinates',
  );

  return [chunkX, chunkY];
}
