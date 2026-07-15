import { hexToBytes } from '@noble/hashes/utils.js';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { keysContract } from '@vers/contract-keys';
import { createServiceToken } from '@vers/service-auth';
import type { CryptoKey } from 'jose';

interface DeriveAvatarRollKeyDeps {
  readonly keysServiceURL: string;
  readonly privateKey: CryptoKey;
}

interface DeriveAvatarRollKeyInput {
  readonly avatarID: string;
  readonly keyVersion: number;
}

/**
 * Derives an avatar's roll key from the keys service over real s2s auth, under `'trade'` (server)
 * custody — the sole population until self-found verification lands.
 */
export async function deriveAvatarRollKey(
  deps: Readonly<DeriveAvatarRollKeyDeps>,
  input: Readonly<DeriveAvatarRollKeyInput>,
): Promise<Uint8Array> {
  const token = await createServiceToken({ audience: 'keys', privateKey: deps.privateKey });

  const client: ContractRouterClient<typeof keysContract> = createORPCClient(
    new RPCLink({
      headers: { authorization: `Bearer ${token}` },
      url: `${deps.keysServiceURL}/rpc`,
    }),
  );

  const result = await client.deriveAvatarKey({
    avatarID: input.avatarID,
    keyVersion: input.keyVersion,
    population: 'trade',
  });

  return hexToBytes(result.key);
}
