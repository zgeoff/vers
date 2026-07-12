import invariant from 'tiny-invariant';

const STATE_HEX_PATTERN = /^[0-9a-f]{32}$/;
const STATE_ALL_ZERO = '0'.repeat(32);
const STATE_WORD_COUNT = 4;
const STATE_WORD_HEX_CHARS = 8;

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
