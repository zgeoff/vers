import { RPCLink } from '@orpc/client/fetch';
import { createIsomorphicFn } from '@tanstack/react-start';
import type { ServiceName } from '@vers/service-auth';
import { buildTraceparent, createTraceContext, findTraceContext } from '@vers/service-utils';
import { createTraceparent } from '../trace/create-traceparent';
import { createEdgeServiceToken } from './create-edge-service-token';
import { loadSessionActor } from './load-session-actor';
import { SERVICE_URLS } from './service-urls';

/**
 * The per-call context every service client accepts: who the outbound s2s token's `sub` claim
 * names. Omitting `actingUserID` (the default) derives it from the ambient `en_session` cookie,
 * proactively re-validating a near-expired session first; an explicit user id mints for that actor
 * with no cookie read or liveness check, for a flow that already holds it with no cookie session
 * yet (login, force-logout); explicit `null` mints a verified-anonymous token with no cookie read.
 */
export interface ServiceLinkContext {
  readonly actingUserID?: string | null;
}

/**
 * Builds one service's isomorphic `RPCLink`: on the server it mints and attaches a short-lived s2s
 * token for the target service; in the browser it goes through this app's `/api/rpc/$service`
 * proxy route (same-origin, so cookies ride along automatically), since services aren't reachable
 * outside the private network.
 */
export function buildServiceLink(service: ServiceName): RPCLink<ServiceLinkContext> {
  return createIsomorphicFn()
    .server(
      () =>
        new RPCLink<ServiceLinkContext>({
          headers: async (options) => {
            // an explicit acting user (login, force-logout) has no cookie session to name, so the
            // token carries no `sid` claim on that path
            const actor =
              options.context.actingUserID === undefined ? await loadSessionActor() : null;

            const actingUserID =
              options.context.actingUserID === undefined
                ? (actor?.userID ?? null)
                : options.context.actingUserID;

            const token = await createEdgeServiceToken({
              actingSessionID: actor?.sessionID ?? null,
              actingUserID,
              audience: service,
            });

            // mint this hop as a child of the request's ambient trace scope; outside a request
            // (background work) no scope exists, which starts a fresh trace instead
            const trace = createTraceContext(findTraceContext());

            return { authorization: `Bearer ${token}`, traceparent: buildTraceparent(trace) };
          },
          url: `${SERVICE_URLS[service]}/rpc`,
        }),
    )
    .client(
      () =>
        new RPCLink<ServiceLinkContext>({
          headers: () => ({ traceparent: createTraceparent() }),
          url: `${globalThis.location.origin}/api/rpc/${service}`,
        }),
    )();
}
