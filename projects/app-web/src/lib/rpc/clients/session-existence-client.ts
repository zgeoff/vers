import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { sessionContract } from '@vers/contract-session';
import { createEdgeServiceToken } from '../create-edge-service-token';
import { SERVICE_URLS } from '../service-urls';

/** The per-call context this client requires: who the outbound s2s token's `sub` claim names. */
interface SessionExistenceClientContext {
  readonly actingUserID: string;
}

/**
 * A bare session client for `loadSessionActor`'s own per-request session-existence check: plain
 * `fetch`, minting an s2s token for the caller-supplied acting user directly. `loadSessionActor` is
 * what establishes a cookie session's identity in the first place, so calling through the
 * isomorphic session client — whose server link derives an omitted acting user id by calling
 * `loadSessionActor` itself — would recurse without bound.
 */
export const sessionExistenceClient: ContractRouterClient<
  typeof sessionContract,
  SessionExistenceClientContext
> = createORPCClient(
  new RPCLink<SessionExistenceClientContext>({
    headers: async (options) => ({
      authorization: `Bearer ${await createEdgeServiceToken({
        actingUserID: options.context.actingUserID,
        audience: 'session',
      })}`,
    }),
    url: `${SERVICE_URLS.session}/rpc`,
  }),
);
