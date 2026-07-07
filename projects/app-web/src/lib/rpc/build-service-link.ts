import { RPCLink } from '@orpc/client/fetch';
import { createIsomorphicFn } from '@tanstack/react-start';
import type { ServiceName } from './service-urls';
import { SERVICE_URLS } from './service-urls';

/**
 * The per-call context every service client accepts: the caller's forwarded session headers on
 * the server branch (the browser branch relies on same-origin cookies instead, so it's optional).
 */
export interface ServiceLinkContext {
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * Builds one service's isomorphic `RPCLink`: on the server it calls straight through to the
 * service, sending whatever session headers the caller passes as per-call `context`; in the
 * browser it goes through this app's `/api/rpc/$service` proxy route (same-origin, so cookies ride
 * along automatically), since services aren't reachable outside the private network.
 */
export function buildServiceLink(service: ServiceName): RPCLink<ServiceLinkContext> {
  return createIsomorphicFn()
    .server(
      () =>
        new RPCLink<ServiceLinkContext>({
          headers: (options) => options.context.headers ?? {},
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
