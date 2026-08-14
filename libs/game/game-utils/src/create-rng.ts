import { uniformInt } from 'pure-rand/distribution/uniformInt';
import { xoroshiro128plusFromState } from 'pure-rand/generator/xoroshiro128plus';
import { decodeState } from './decode-state';
import { encodeState } from './encode-state';
import type { RNG } from './types';

export function createRNG(state: string): RNG {
  const gen = xoroshiro128plusFromState(decodeState(state));
  const getInt = (min: number, max: number) => uniformInt(gen, min, max);

  return {
    getInt,
    getState: () => encodeState(gen.getState()),
  };
}
