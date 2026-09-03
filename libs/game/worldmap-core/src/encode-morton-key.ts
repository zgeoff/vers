import invariant from 'tiny-invariant';
import { canEncodeMortonKey } from './can-encode-morton-key';
import { MORTON_AXIS_BITS } from './consts';

export function encodeMortonKey(coord: readonly [number, number]): number {
  invariant(
    canEncodeMortonKey(coord),
    `coordinate outside the packable range: ${coord[0]}_${coord[1]}`,
  );

  const zx = toZigzag(coord[0]);
  const zy = toZigzag(coord[1]);
  let key = 0;

  // Built from plain arithmetic rather than bitwise operators, since JS's bitwise operators
  // truncate to 32 bits and the interleaved result runs past that width.
  for (let bit = 0; bit < MORTON_AXIS_BITS; bit++) {
    const xBit = Math.floor(zx / 2 ** bit) % 2;
    const yBit = Math.floor(zy / 2 ** bit) % 2;

    key += xBit * 2 ** (2 * bit) + yBit * 2 ** (2 * bit + 1);
  }

  return key;
}

function toZigzag(n: number): number {
  return n >= 0 ? n * 2 : -n * 2 - 1;
}
