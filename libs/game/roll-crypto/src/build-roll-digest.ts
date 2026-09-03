import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export function buildRollDigest(avatarKey: Uint8Array, coordinateBytes: Uint8Array): string {
  return bytesToHex(hmac(sha256, avatarKey, coordinateBytes));
}
