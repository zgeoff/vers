import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { deriveAvatarKey as deriveKey } from '@vers/roll-crypto';
import { os } from './os';

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
