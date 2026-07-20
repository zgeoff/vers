import { bytesToHex } from '@noble/hashes/utils.js';

const ALL_ZERO_SEED = '0'.repeat(32);

/**
 * Mints a server CSPRNG genesis seed for a node's first activity: a 128-bit state as a 32-char
 * lowercase hex string. Deterministic re-derivation is not needed because the value is stored on
 * the chain row. Sourced from the Web Crypto global so the contract package stays loadable in
 * every runtime it ships to — server, browser, and worker bundles alike.
 */
export function createGenesisSeed(): string {
  let seed = buildRandomHex();

  while (seed === ALL_ZERO_SEED) {
    seed = buildRandomHex();
  }

  return seed;
}

function buildRandomHex(): string {
  return bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}
