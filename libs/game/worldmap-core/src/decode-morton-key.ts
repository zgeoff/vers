import { MORTON_AXIS_BITS } from './consts';

/**
 * Reverses `encodeMortonKey`, recovering the signed cell coordinate a Morton key encodes: the two
 * interleaved bit streams split back into their per-axis zigzag values, then each un-zigzags to its
 * original signed integer. Exact inverse — every key `encodeMortonKey` produces decodes back to the
 * coordinate it packed.
 */
export function decodeMortonKey(key: number): [number, number] {
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
