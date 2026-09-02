import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { sessionContract } from '@vers/contract-session';
import { buildTracingInterceptor } from '@vers/service-utils/orpc';
import { createEdgeServiceToken } from '../create-edge-service-token';
import { SERVICE_URLS } from '../service-urls';

// a bare client on purpose: this link never derives its token from the cookie or retries, since a
// failing refresh call that triggered another refresh would recurse without bound
export const sessionRefreshClient: ContractRouterClient<typeof sessionContract> = createORPCClient(
  new RPCLink({
    clientInterceptors: [buildTracingInterceptor()],
    headers: async () => ({
      authorization: `Bearer ${await createEdgeServiceToken({ actingUserID: null, audience: 'session' })}`,
    }),
    url: `${SERVICE_URLS.session}/rpc`,
  }),
);
