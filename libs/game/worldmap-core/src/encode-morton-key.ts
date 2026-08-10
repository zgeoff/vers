import invariant from 'tiny-invariant';
import { MORTON_AXIS_BITS } from './consts';

/**
 * Encodes a signed cell coordinate as one packed Morton/z-order key: each axis zigzag-encodes to a
 * non-negative integer, then the two axes' bits interleave one at a time so nearby cells land near
 * each other in numeric sort order and a 2D box reads as one 1D range. Reversed by
 * `decodeMortonKey`. Built from plain arithmetic rather than bitwise operators, since JS's bitwise
 * operators truncate to 32 bits and the interleaved result runs past that width.
 */
export function encodeMortonKey(coord: readonly [number, number]): number {
  const zx = toZigzag(coord[0]);
  const zy = toZigzag(coord[1]);

  invariant(
    zx < 2 ** MORTON_AXIS_BITS && zy < 2 ** MORTON_AXIS_BITS,
    `coordinate outside the packable range: ${coord[0]}_${coord[1]}`,
  );

  let key = 0;

  for (let bit = 0; bit < MORTON_AXIS_BITS; bit++) {
    const xBit = Math.floor(zx / 2 ** bit) % 2;
    const yBit = Math.floor(zy / 2 ** bit) % 2;

    key += xBit * 2 ** (2 * bit) + yBit * 2 ** (2 * bit + 1);
  }

  return key;
}

/**
 * Maps a signed integer onto the non-negative integers, alternating sign each step
 * (`0, -1, 1, -2, 2, …`) so a small magnitude of either sign packs into few bits.
 */
function toZigzag(n: number): number {
  return n >= 0 ? n * 2 : -n * 2 - 1;
}
