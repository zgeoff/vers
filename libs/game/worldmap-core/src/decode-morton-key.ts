import invariant from 'tiny-invariant';
import { MORTON_AXIS_BITS } from './consts';

/**
 * Recovers the signed cell coordinate a Morton key encodes: the two interleaved bit streams split
 * back into their per-axis zigzag values, then each un-zigzags to its original signed integer. Exact
 * inverse of the packing — every key the Morton encoder produces decodes back to the coordinate it
 * packed.
 *
 * A key that is not a non-negative integer inside the packed width was never produced by the
 * encoder, and is rejected rather than decoded into a coordinate nothing packs to.
 */
export function decodeMortonKey(key: number): [number, number] {
  invariant(
    Number.isInteger(key) && key >= 0 && key < 2 ** (2 * MORTON_AXIS_BITS),
    `key outside the packed range: ${key}`,
  );

  let zx = 0;
  let zy = 0;

  for (let bit = 0; bit < MORTON_AXIS_BITS; bit++) {
    const xBit = Math.floor(key / 2 ** (2 * bit)) % 2;
    const yBit = Math.floor(key / 2 ** (2 * bit + 1)) % 2;

    zx += xBit * 2 ** bit;
    zy += yBit * 2 ** bit;
  }

  return [decodeZigzag(zx), decodeZigzag(zy)];
}

/**
 * Reverses the zigzag mapping that packs a signed integer into the non-negative integers: an even
 * value halves back to its non-negative source, an odd value maps back to its negative pair.
 */
function decodeZigzag(z: number): number {
  return z % 2 === 0 ? z / 2 : -(z + 1) / 2;
}
