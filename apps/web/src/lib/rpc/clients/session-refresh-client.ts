import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { sessionContract } from '@vers/contract-session';
import { buildTracingInterceptor } from '@vers/service-utils/orpc';
import { createEdgeServiceToken } from '../create-edge-service-token';
import { SERVICE_URLS } from '../service-urls';

/**
 * A bare session client for the token-refresh path: plain `fetch`, minting an anonymous s2s token
 * for every call (`refreshTokens` is body-keyed, so no acting user id is needed). This link never
 * derives its token from a cookie or retries on failure — a failing refresh call must never trigger
 * another refresh, recursing without bound.
 */
export const sessionRefreshClient: ContractRouterClient<typeof sessionContract> = createORPCClient(
  new RPCLink({
    clientInterceptors: [buildTracingInterceptor()],
    headers: async () => ({
      authorization: `Bearer ${await createEdgeServiceToken({ actingUserID: null, audience: 'session' })}`,
    }),
    url: `${SERVICE_URLS.session}/rpc`,
  }),
);
