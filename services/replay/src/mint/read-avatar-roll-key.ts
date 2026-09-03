import { hexToBytes } from '@noble/hashes/utils.js';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { keysContract } from '@vers/contract-keys';
import { createServiceToken } from '@vers/service-auth';
import { buildTracingInterceptor } from '@vers/service-utils/orpc';
import type { CryptoKey } from 'jose';

const DEFAULT_KEYS_DISPATCH_TIMEOUT_MS = 10_000;

interface ReadAvatarRollKeyDeps {
  readonly keysServiceURL: string;
  readonly privateKey: CryptoKey;

  readonly timeoutMs?: number;
}

interface ReadAvatarRollKeyInput {
  readonly avatarID: string;
  readonly keyVersion: number;
}

export async function readAvatarRollKey(
  deps: Readonly<ReadAvatarRollKeyDeps>,
  input: Readonly<ReadAvatarRollKeyInput>,
): Promise<Uint8Array> {
  const token = await createServiceToken({
    audience: 'keys',
    issuer: 'service-replay',
    privateKey: deps.privateKey,
  });

  const client: ContractRouterClient<typeof keysContract> = createORPCClient(
    new RPCLink({
      clientInterceptors: [buildTracingInterceptor()],
      headers: { authorization: `Bearer ${token}` },
      url: `${deps.keysServiceURL}/rpc`,
    }),
  );

  const result = await client.deriveAvatarKey(
    { avatarID: input.avatarID, keyVersion: input.keyVersion, population: 'trade' },
    { signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_KEYS_DISPATCH_TIMEOUT_MS) },
  );

  return hexToBytes(result.key);
}
