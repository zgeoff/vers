import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import { sessionContract } from '@vers/contract-session';
import { buildTracingInterceptor, makeIsRetryable } from '@vers/service-utils/orpc';
import { createEdgeServiceToken } from '../create-edge-service-token';
import { makeBoundedFetch } from '../make-bounded-fetch';
import { SERVICE_URLS } from '../service-urls';

const boundedFetch = makeBoundedFetch({
  isRetryable: makeIsRetryable(sessionContract),
  service: 'session',
});

// a bare, anonymous link: the key set is read while no acting user is established yet, and the
// isomorphic session client would derive one from the very session this read verifies
export const sessionKeysClient: ContractRouterClient<typeof sessionContract> = createORPCClient(
  new RPCLink({
    clientInterceptors: [buildTracingInterceptor()],
    fetch: boundedFetch,
    headers: async () => ({
      authorization: `Bearer ${await createEdgeServiceToken({
        actingUserID: null,
        audience: 'session',
      })}`,
    }),
    url: `${SERVICE_URLS.session}/rpc`,
  }),
);
