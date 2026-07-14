import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { deriveAvatarKey as deriveKey } from '@vers/roll-crypto';
import { os } from './os';

/**
 * Derives a roll key through the real `@vers/roll-crypto` derivation, rooted at a fixed mock
 * secret per population and key version — so keys are real 64-hex values, deterministic across
 * runs, and distinct per input. Every key version is provisioned; the real service's NOT_FOUND
 * for an unknown version is a per-test override.
 */
export const deriveAvatarKey = os.deriveAvatarKey.handler((opts) => {
  const root = sha256(
    utf8ToBytes(`vers-mock-root|${opts.input.population}|${opts.input.keyVersion}`),
  );

  const key = deriveKey({
    avatarID: opts.input.avatarID,
    keyVersion: opts.input.keyVersion,
    population: opts.input.population,
    root,
  });

  return { key: bytesToHex(key) };
});
