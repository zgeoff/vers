import type { ServiceName } from '../rpc/service-urls';
import { SERVICE_URLS } from '../rpc/service-urls';

/**
 * Forwards one browser oRPC call to its service, rewriting `/api/rpc/<service>/*` to
 * `<service origin>/rpc/*`. Browser traffic can't reach services directly (private network in
 * production), so it always round-trips through this same-origin proxy; cookies ride along
 * because the browser's own call to this route is same-origin.
 */
export async function forwardRPCRequest(request: Request, service: ServiceName): Promise<Response> {
  const incoming = new URL(request.url);

  const prefix = `/api/rpc/${service}`;

  const target = new URL(
    incoming.pathname.replace(prefix, '/rpc') + incoming.search,
    SERVICE_URLS[service],
  );

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  return fetch(target, {
    headers: request.headers,
    method: request.method,
    ...(hasBody && { body: await request.blob() }),
  });
}
