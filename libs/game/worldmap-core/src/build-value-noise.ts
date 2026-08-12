import { buildCoordHashUnit } from './build-coord-hash';

/**
 * Value noise at a real-valued position: bilinear interpolation of `buildCoordHashUnit` over the
 * integer lattice surrounding `(x, y)`, on the given draw channel. Deterministic and seed-stable
 * like the hash it rides — no dependency, no stored gradients. Returns a value in `[0, 1)`; the
 * caller picks the sampling frequency by scaling `x` and `y` before the call.
 */
export function buildValueNoise(userSeed: number, x: number, y: number, channel: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const v00 = buildCoordHashUnit(userSeed, x0, y0, channel);
  const v10 = buildCoordHashUnit(userSeed, x0 + 1, y0, channel);
  const v01 = buildCoordHashUnit(userSeed, x0, y0 + 1, channel);
  const v11 = buildCoordHashUnit(userSeed, x0 + 1, y0 + 1, channel);
  const top = v00 + (v10 - v00) * tx;
  const bottom = v01 + (v11 - v01) * tx;

  return top + (bottom - top) * ty;
}
