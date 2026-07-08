import { RPCLink } from '@orpc/client/fetch';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getAuthSession } from '../auth/get-auth-session';
import { buildAuthHeaders } from './build-auth-headers';
import { buildAuthenticatedFetch } from './build-authenticated-fetch';
import type { ServiceName } from './service-urls';
import { SERVICE_URLS } from './service-urls';

/**
 * The per-call context every service client accepts: the caller's forwarded session headers on
 * the server branch (the browser branch relies on same-origin cookies instead, so it's optional).
 * Omitting `headers` entirely falls back to the caller's own `en_session` cookie; passing an
 * explicit object (even `{}`) takes exact control instead, for flows authenticating as a session
 * that isn't yet the cookie's own (login, force-logout) or a test simulating a specific state.
 */
export interface ServiceLinkContext {
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * Builds one service's isomorphic `RPCLink`: on the server it calls straight through to the
 * service, sending the caller's forwarded or cookie-derived session headers and transparently
 * retrying a `401` after a token refresh; in the browser it goes through this app's
 * `/api/rpc/$service` proxy route (same-origin, so cookies ride along automatically), since
 * services aren't reachable outside the private network.
 */
export function buildServiceLink(service: ServiceName): RPCLink<ServiceLinkContext> {
  return createIsomorphicFn()
    .server(
      () =>
        new RPCLink<ServiceLinkContext>({
          fetch: buildAuthenticatedFetch(),
          headers: async (options) => {
            if (options.context.headers !== undefined) {
              return options.context.headers;
            }

            const session = await getAuthSession();

            return buildAuthHeaders(session);
          },
          url: `${SERVICE_URLS[service]}/rpc`,
        }),
    )
    .client(
      () =>
        new RPCLink<ServiceLinkContext>({
          url: `${globalThis.location.origin}/api/rpc/${service}`,
        }),
    )();
}
