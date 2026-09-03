import invariant from 'tiny-invariant';
import { MORTON_AXIS_BITS } from './consts';

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

function decodeZigzag(z: number): number {
  return z % 2 === 0 ? z / 2 : -(z + 1) / 2;
}
