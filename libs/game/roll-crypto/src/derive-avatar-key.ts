import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import type { Population } from './types';

export interface DeriveAvatarKeyInput {
  readonly avatarID: string;
  readonly keyVersion: number;
  readonly population: Population;
  readonly root: Uint8Array;
}

/**
 * Derives a 32-byte avatar roll key via HKDF-SHA256 from a population root secret. Pure and
 * bit-for-bit reproducible: identical input always yields an identical key.
 *
 * The info-string layout (`vers/avatar-key/v1|${population}|${avatarID}|${keyVersion}`) is frozen.
 * Its `v1` segment is scheme versioning — it changes only when the derivation algorithm or field
 * layout changes — distinct from `keyVersion`, which rotates the root secret within a fixed scheme.
 * The population appears both in the caller's choice of root and in the info string by design, so a
 * key derived under the wrong root can never collide with the correct one.
 */
export function deriveAvatarKey(input: Readonly<DeriveAvatarKeyInput>): Uint8Array {
  const info = utf8ToBytes(
    `vers/avatar-key/v1|${input.population}|${input.avatarID}|${input.keyVersion}`,
  );

  return hkdf(sha256, input.root, undefined, info, 32);
}
