import { RPCLink } from '@orpc/client/fetch';
import type { AnyContractRouter } from '@orpc/contract';
import type { ServiceName } from '@vers/service-auth';
import {
  buildRetryInterceptor,
  buildTracingInterceptor,
  makeIsRetryable,
} from '@vers/service-utils/orpc';
import { recordServiceCallRetry } from '../metrics/record-service-call-retry';
import { createEdgeServiceToken } from './create-edge-service-token';
import { loadSessionActor } from './load-session-actor';
import { makeBoundedFetch } from './make-bounded-fetch';
import { SERVICE_URLS } from './service-urls';
import type { ServiceLinkContext } from './types';

/**
 * Builds one service's server-branch `RPCLink`: mints and attaches a short-lived s2s token for the
 * target service, bounds each outbound attempt to a single timeout, and retries on a transient
 * failure — a never-reached (transport) failure retries for any method since nothing applied, while
 * a timeout or a 5xx retries only for the contract's idempotent procedures. Callers invoke this only
 * from inside a `createIsomorphicFn().server()` branch — the contract reference, and everything it
 * pulls in, must never reach the browser bundle.
 */
export function buildServiceLink(
  service: ServiceName,
  contract: AnyContractRouter,
): RPCLink<ServiceLinkContext> {
  return new RPCLink<ServiceLinkContext>({
    clientInterceptors: [
      buildTracingInterceptor(),
      buildRetryInterceptor({
        isRetryable: makeIsRetryable(contract),
        onRetry: () => {
          recordServiceCallRetry(service);
        },
      }),
    ],
    fetch: makeBoundedFetch({ service }),
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
