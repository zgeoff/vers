import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import { encodeState } from './encode-state';

export function buildStateFromSeed(seed: number): string {
  return encodeState(xoroshiro128plus(seed).getState());
}
