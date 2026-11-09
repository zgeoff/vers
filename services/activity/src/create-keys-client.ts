import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createServiceToken } from '@vers/service-auth';
import { makeTracingInterceptor } from '@vers/service-utils/orpc';
import type { CryptoKey } from 'jose';
import type { KeysClient } from './types';

interface CreateKeysClientDeps {
  readonly keysServiceURL: string;
  readonly privateKey: CryptoKey;
}

export function createKeysClient(deps: Readonly<CreateKeysClientDeps>): KeysClient {
  return createORPCClient(
    new RPCLink({
      clientInterceptors: [makeTracingInterceptor()],
      headers: async () => {
        const token = await createServiceToken({
          audience: 'keys',
          issuer: 'service-activity',
          privateKey: deps.privateKey,
        });

        return { authorization: `Bearer ${token}` };
      },
      url: `${deps.keysServiceURL}/rpc`,
    }),
  );
}
