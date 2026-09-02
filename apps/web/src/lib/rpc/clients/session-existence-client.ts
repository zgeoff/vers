import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { sessionContract } from '@vers/contract-session';
import { buildTracingInterceptor } from '@vers/service-utils/orpc';
import { createEdgeServiceToken } from '../create-edge-service-token';
import { SERVICE_URLS } from '../service-urls';

interface SessionExistenceClientContext {
  readonly actingUserID: string;
}

// a bare client on purpose: the isomorphic session client's server link derives an omitted acting
// user from the same routine this check runs inside, so calling through it would recurse without
// bound
export const sessionExistenceClient: ContractRouterClient<
  typeof sessionContract,
  SessionExistenceClientContext
> = createORPCClient(
  new RPCLink<SessionExistenceClientContext>({
    clientInterceptors: [buildTracingInterceptor()],
    headers: async (options) => ({
      authorization: `Bearer ${await createEdgeServiceToken({
        actingUserID: options.context.actingUserID,
        audience: 'session',
      })}`,
    }),
    url: `${SERVICE_URLS.session}/rpc`,
  }),
);
