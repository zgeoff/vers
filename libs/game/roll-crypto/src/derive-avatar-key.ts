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

export function deriveAvatarKey(input: Readonly<DeriveAvatarKeyInput>): Uint8Array {
  const info = utf8ToBytes(
    `vers/avatar-key/v1|${input.population}|${input.avatarID}|${input.keyVersion}`,
  );

  return hkdf(sha256, input.root, undefined, info, 32);
}
