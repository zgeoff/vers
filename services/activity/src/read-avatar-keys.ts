import { hexToBytes } from '@noble/hashes/utils.js';
import type { SecretRef } from '@vers/contract-keys';
import type { AvatarKeys } from '@vers/qa-account';
import type { KeysClient } from './types';

interface ReadAvatarKeysInput {
  readonly avatarID: string;
  readonly keyVersion: number;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
}

const KEYS_DISPATCH_TIMEOUT_MS = 10_000;

export async function readAvatarKeys(
  keysClient: KeysClient,
  input: Readonly<ReadAvatarKeysInput>,
): Promise<AvatarKeys> {
  const [rollKey, scopeSecret] = await Promise.all([
    keysClient.deriveAvatarKey(
      { avatarID: input.avatarID, keyVersion: input.keyVersion, population: 'trade' },
      { signal: AbortSignal.timeout(KEYS_DISPATCH_TIMEOUT_MS) },
    ),
    keysClient.deriveScopeSecret(
      { avatarID: input.avatarID, secretRef: input.secretRef, secretVersion: input.secretVersion },
      { signal: AbortSignal.timeout(KEYS_DISPATCH_TIMEOUT_MS) },
    ),
  ]);

  return { rollKey: hexToBytes(rollKey.key), scopeSecret: hexToBytes(scopeSecret.secret) };
}
