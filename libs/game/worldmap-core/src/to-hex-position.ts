import { HEX_SIZE } from './consts';

const SQRT_3 = Math.sqrt(3);

export function toHexPosition(cx: number, cy: number): [number, number] {
  const x = HEX_SIZE * SQRT_3 * (cx + cy / 2);
  const y = HEX_SIZE * (3 / 2) * cy;

  return [x, y];
}
