import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import { encodeState } from './encode-state';

/**
 * Derives a 128-bit rng state from a plain numeric seed, for callers that legitimately seed from a
 * number (a world map node's stored seed, an initial placeholder state, tests). Seed `0` scrambles
 * to a valid non-zero state.
 */
export function buildStateFromSeed(seed: number): string {
  return encodeState(xoroshiro128plus(seed).getState());
}
