import invariant from 'tiny-invariant';

export function parseChunkKey(key: string): readonly [chunkX: number, chunkY: number] {
  const parts = key.split('_');
  const [rawX, rawY] = parts;
  const chunkX = Number(rawX);
  const chunkY = Number(rawY);

  // an empty component must fail too: `Number('')` silently coerces to 0
  invariant(
    parts.length === 2 &&
      rawX !== '' &&
      rawY !== '' &&
      Number.isInteger(chunkX) &&
      Number.isInteger(chunkY),
    'a chunk key always encodes two integer coordinates',
  );

  return [chunkX, chunkY];
}
