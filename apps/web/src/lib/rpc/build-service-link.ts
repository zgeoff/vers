import { RPCLink } from '@orpc/client/fetch';
import type { AnyContractRouter } from '@orpc/contract';
import type { ServiceName } from '@vers/service-auth';
import { buildTracingInterceptor, makeIsRetryable } from '@vers/service-utils/orpc';
import { createEdgeServiceToken } from './create-edge-service-token';
import { loadSessionActor } from './load-session-actor';
import { makeBoundedFetch } from './make-bounded-fetch';
import { SERVICE_URLS } from './service-urls';
import type { ServiceLinkContext } from './types';

/**
 * Builds one service's server-branch `RPCLink`: mints and attaches a short-lived s2s token for the
 * target service, and bounds/retries each outbound attempt per the contract's declared idempotent
 * procedures. Callers invoke this only from inside a `createIsomorphicFn().server()` branch — the
 * contract reference, and everything it pulls in, must never reach the browser bundle.
 */
export function buildServiceLink(
  service: ServiceName,
  contract: AnyContractRouter,
): RPCLink<ServiceLinkContext> {
  return new RPCLink<ServiceLinkContext>({
    clientInterceptors: [buildTracingInterceptor()],
    fetch: makeBoundedFetch({ isRetryable: makeIsRetryable(contract), service }),
    headers: async (options) => {
      // an explicit acting user (login, force-logout) has no cookie session to name, so the token
      // carries no `sid` claim on that path
      const actor = options.context.actingUserID === undefined ? await loadSessionActor() : null;

      const actingUserID =
        options.context.actingUserID === undefined
          ? (actor?.userID ?? null)
          : options.context.actingUserID;

      const token = await createEdgeServiceToken({
        actingSessionID: actor?.sessionID ?? null,
        actingUserID,
        audience: service,
      });

      return { authorization: `Bearer ${token}` };
    },
    url: `${SERVICE_URLS[service]}/rpc`,
  });
}
