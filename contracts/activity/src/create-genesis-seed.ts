import { bytesToHex } from '@noble/hashes/utils.js';

const ALL_ZERO_SEED = '0'.repeat(32);

export function createGenesisSeed(): string {
  let seed = buildRandomHex();

  while (seed === ALL_ZERO_SEED) {
    seed = buildRandomHex();
  }

  return seed;
}

// the Web Crypto global, not node:crypto: this package also ships in browser and worker bundles
function buildRandomHex(): string {
  return bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}
