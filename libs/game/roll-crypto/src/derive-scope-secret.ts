import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

export interface DeriveScopeSecretInput {
  readonly avatarID: string;
  readonly secretRef: string;
  readonly secretVersion: number;
  readonly root: Uint8Array;
}

export function deriveScopeSecret(input: Readonly<DeriveScopeSecretInput>): Uint8Array {
  const info = utf8ToBytes(
    `vers/scope-secret/v1|${input.secretRef}|${input.avatarID}|${input.secretVersion}`,
  );

  return hkdf(sha256, input.root, undefined, info, 32);
}
