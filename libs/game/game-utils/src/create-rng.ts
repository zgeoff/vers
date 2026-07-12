import { uniformInt } from 'pure-rand/distribution/uniformInt';
import { xoroshiro128plus, xoroshiro128plusFromState } from 'pure-rand/generator/xoroshiro128plus';
import invariant from 'tiny-invariant';
import type { RNG } from './types';

const STATE_HEX_PATTERN = /^[0-9a-f]{32}$/;
const STATE_ALL_ZERO = '0'.repeat(32);
const STATE_WORD_COUNT = 4;
const STATE_WORD_HEX_CHARS = 8;

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

/**
 * Decodes a 32-character hex string into the four 32-bit words xoroshiro128+ carries as state.
 * Round-trips `encodeState` exactly — word order is preserved, never interpreted. Throws on a
 * malformed string or the all-zero state, xoroshiro128+'s degenerate fixed point.
 */
export function decodeState(hex: string): Array<number> {
  invariant(STATE_HEX_PATTERN.test(hex), 'rng state must be a 32-character lowercase hex string');

  invariant(
    hex !== STATE_ALL_ZERO,
    'rng state must not be the all-zero xoroshiro128plus fixed point',
  );

  return Array.from({ length: STATE_WORD_COUNT }, (_, index) => {
    const chunk = hex.slice(index * STATE_WORD_HEX_CHARS, (index + 1) * STATE_WORD_HEX_CHARS);

    // oxlint-disable-next-line unicorn/prefer-math-trunc -- reinterprets the unsigned hex value as a signed 32-bit int; Math.trunc only drops a fractional part, it doesn't wrap the high bit
    return parseInt(chunk, 16) | 0;
  });
}

/**
 * Encodes xoroshiro128+'s four 32-bit state words into a 32-character hex string, one
 * 8-character chunk per word in the order given.
 */
export function encodeState(words: ReadonlyArray<number>): string {
  return words
    .map((word) => {
      // oxlint-disable-next-line unicorn/prefer-math-trunc -- reinterprets a signed 32-bit int as unsigned; Math.trunc only drops a fractional part, it doesn't clear the sign bit
      const unsigned = word >>> 0;

      return unsigned.toString(16).padStart(8, '0');
    })
    .join('');
}

/**
 * Derives a 128-bit rng state from a plain numeric seed, for callers that legitimately seed from a
 * number (a world map node's stored seed, an initial placeholder state, tests). Seed `0` scrambles
 * to a valid non-zero state.
 */
export function stateFromSeed(seed: number): string {
  return encodeState(xoroshiro128plus(seed).getState());
}
