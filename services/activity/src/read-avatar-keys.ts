import { hexToBytes } from '@noble/hashes/utils.js';
import { ORPCError } from '@orpc/client';
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
  try {
    const [rollKey, scopeSecret] = await Promise.all([
      keysClient.deriveAvatarKey(
        { avatarID: input.avatarID, keyVersion: input.keyVersion, population: 'trade' },
        { signal: AbortSignal.timeout(KEYS_DISPATCH_TIMEOUT_MS) },
      ),
      keysClient.deriveScopeSecret(
        {
          avatarID: input.avatarID,
          secretRef: input.secretRef,
          secretVersion: input.secretVersion,
        },
        { signal: AbortSignal.timeout(KEYS_DISPATCH_TIMEOUT_MS) },
      ),
    ]);

    return { rollKey: hexToBytes(rollKey.key), scopeSecret: hexToBytes(scopeSecret.secret) };
  } catch (error) {
    // the keys service's own 4xx would otherwise pass through as the caller's outcome
    throw new Error(`the keys service failed: ${formatKeysFailure(error)}`, { cause: error });
  }
}

function formatKeysFailure(error: unknown): string {
  if (error instanceof ORPCError) {
    return `${error.code} ${error.status}`;
  }

  return error instanceof Error ? error.message : String(error);
}
