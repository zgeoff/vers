import { randomBytes } from 'node:crypto';

const ALL_ZERO_SEED = '0'.repeat(32);

/**
 * Mints a server CSPRNG genesis seed for a node's first activity: a 128-bit state as a 32-char
 * lowercase hex string. Deterministic re-derivation is not needed because the value is stored on
 * the chain row.
 */
export function createGenesisSeed(): string {
  let seed = randomBytes(16).toString('hex');

  while (seed === ALL_ZERO_SEED) {
    seed = randomBytes(16).toString('hex');
  }

  return seed;
}
