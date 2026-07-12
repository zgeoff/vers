import { uniformInt } from 'pure-rand/distribution/uniformInt';
import { xoroshiro128plusFromState } from 'pure-rand/generator/xoroshiro128plus';
import { decodeState } from './decode-state';
import { encodeState } from './encode-state';
import type { RNG } from './types';

/**
 * thin wrapper around pure-rand as it's interface is verbose and we don't need
 * most of it
 *
 * @param state - the 128-bit xoroshiro128+ state to rehydrate, as a 32-character hex string
 * @returns a thin wrapper around pure-rand
 */
export function createRNG(state: string): RNG {
  const gen = xoroshiro128plusFromState(decodeState(state));
  const getInt = (min: number, max: number) => uniformInt(gen, min, max);

  const getSeries = (min: number, max: number, count: number) =>
    Array.from({ length: count }, () => getInt(min, max));

  return {
    getInt,
    getSeries,
    getState: () => encodeState(gen.getState()),
  };
}
