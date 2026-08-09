import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import type { SecretRef } from '@vers/contract-keys';
import { deriveScopeSecret } from '@vers/roll-crypto';

/**
 * Derives a scope secret through the real `@vers/roll-crypto` derivation, rooted at a fixed mock
 * secret per scope ref and secret version — so callers outside the mock backend (a replay fixture)
 * can derive the identical secret the mock `deriveScopeSecret` procedure would return, without a
 * round trip.
 */
export function buildMockScopeSecret(
  avatarID: string,
  secretRef: SecretRef,
  secretVersion: number,
): Uint8Array {
  const root = sha256(utf8ToBytes(`vers-mock-root|scope|${secretRef}|${secretVersion}`));

  return deriveScopeSecret({ avatarID, root, secretRef, secretVersion });
}
