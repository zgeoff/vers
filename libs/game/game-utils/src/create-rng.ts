import { uniformInt } from 'pure-rand/distribution/uniformInt';
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import type { RNG } from './types';

/**
 * thin wrapper around pure-rand as it's interface is verbose and we don't need
 * most of it
 *
 * @param seed - the seed to create the rng with
 * @returns a thin wrapper around pure-rand
 */
export function createRNG(initialSeed: number): RNG {
  let seed = initialSeed;
  let rng = xoroshiro128plus(seed);
  const getInt = (min: number, max: number) => uniformInt(rng, min, max);

  const generateNewSeed = () => {
    seed = getInt(0, 0x100000000);
    rng = xoroshiro128plus(seed);

    return seed;
  };

  const getSeries = (min: number, max: number, count: number) =>
    Array.from({ length: count }, () => getInt(min, max));

  return {
    generateNewSeed,
    getInt,
    getSeries,
    get seed() {
      return seed;
    },
  };
}
