import { RPCLink } from '@orpc/client/fetch';
import type { ServiceName } from '@vers/service-auth';
import { buildTraceparent, createTraceContext } from '@vers/trace';
import type { ServiceLinkContext } from './types';

/**
 * Builds one service's browser-branch `RPCLink`: goes through this app's same-origin
 * `/api/rpc/$service` proxy route (so cookies ride along automatically), since services aren't
 * reachable from the browser outside the private network. No OTel here — the SharedWorker/browser
 * client keeps minting its own header.
 */
export function buildProxyServiceLink(service: ServiceName): RPCLink<ServiceLinkContext> {
  return new RPCLink<ServiceLinkContext>({
    headers: () => ({ traceparent: buildTraceparent(createTraceContext()) }),
    url: `${globalThis.location.origin}/api/rpc/${service}`,
  });
}
