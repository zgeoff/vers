import invariant from 'tiny-invariant';

export function parseChunkKey(key: string): readonly [chunkX: number, chunkY: number] {
  const parts = key.split('_');
  const [rawX, rawY] = parts;
  const chunkX = Number(rawX);
  const chunkY = Number(rawY);

  // reject anything `buildChunkKey` could not have minted: a wrong component count, or an empty
  // component `Number` would silently coerce to 0 (`Number('') === 0`)
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
