import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

export interface DeriveScopeSecretInput {
  readonly avatarID: string;
  readonly secretRef: string;
  readonly secretVersion: number;
  readonly root: Uint8Array;
}

/**
 * Derives a 32-byte scope secret via HKDF-SHA256 from a scope root secret. Pure: identical input
 * always yields an identical secret.
 *
 * The info-string layout (`vers/scope-secret/v1|${secretRef}|${avatarID}|${secretVersion}`) is
 * frozen. Its `v1` segment is scheme versioning — it changes only when the derivation algorithm or
 * field layout changes — distinct from `secretVersion`, which rotates the root secret within a
 * fixed scheme. The scope ref appears both in the caller's choice of root and in the info string by
 * design, so a secret derived under the wrong root can never collide with the correct one.
 */
export function deriveScopeSecret(input: Readonly<DeriveScopeSecretInput>): Uint8Array {
  const info = utf8ToBytes(
    `vers/scope-secret/v1|${input.secretRef}|${input.avatarID}|${input.secretVersion}`,
  );

  return hkdf(sha256, input.root, undefined, info, 32);
}
