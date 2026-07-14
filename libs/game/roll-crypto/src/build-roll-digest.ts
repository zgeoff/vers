import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/**
 * Builds the keyed PRF digest for rolled-reward content: HMAC-SHA256 over `coordinateBytes` under
 * `avatarKey`, returned as lowercase hex. Coordinate encoding is the caller's concern — this
 * function treats `coordinateBytes` as opaque canonical bytes.
 */
export function buildRollDigest(avatarKey: Uint8Array, coordinateBytes: Uint8Array): string {
  return bytesToHex(hmac(sha256, avatarKey, coordinateBytes));
}
