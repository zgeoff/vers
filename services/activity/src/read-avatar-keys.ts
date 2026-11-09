import { hexToBytes } from '@noble/hashes/utils.js';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { SecretRef, keysContract } from '@vers/contract-keys';
import type { AvatarKeys } from '@vers/qa-account';
import { createServiceToken } from '@vers/service-auth';
import { makeTracingInterceptor } from '@vers/service-utils/orpc';
import { readScopeSecret } from '@vers/worldmap-content';
import type { CryptoKey } from 'jose';

interface ReadAvatarKeysDeps {
  readonly keysServiceURL: string;
  readonly privateKey: CryptoKey;
}

interface ReadAvatarKeysInput {
  readonly avatarID: string;
  readonly keyVersion: number;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
}

const KEYS_DISPATCH_TIMEOUT_MS = 10_000;

export async function readAvatarKeys(
  deps: Readonly<ReadAvatarKeysDeps>,
  input: Readonly<ReadAvatarKeysInput>,
): Promise<AvatarKeys> {
  const token = await createServiceToken({
    audience: 'keys',
    issuer: 'service-activity',
    privateKey: deps.privateKey,
  });

  const client: ContractRouterClient<typeof keysContract> = createORPCClient(
    new RPCLink({
      clientInterceptors: [makeTracingInterceptor()],
      headers: { authorization: `Bearer ${token}` },
      url: `${deps.keysServiceURL}/rpc`,
    }),
  );

  const [rollKey, scopeSecret] = await Promise.all([
    client.deriveAvatarKey(
      { avatarID: input.avatarID, keyVersion: input.keyVersion, population: 'trade' },
      { signal: AbortSignal.timeout(KEYS_DISPATCH_TIMEOUT_MS) },
    ),
    readScopeSecret(
      {
        issuer: 'service-activity',
        keysServiceURL: deps.keysServiceURL,
        privateKey: deps.privateKey,
      },
      { avatarID: input.avatarID, secretRef: input.secretRef, secretVersion: input.secretVersion },
    ),
  ]);

  return { rollKey: hexToBytes(rollKey.key), scopeSecret };
}
