import { createEdgeServiceToken } from '../rpc/create-edge-service-token';
import { loadSessionActor } from '../rpc/load-session-actor';
import type { ServiceName } from '../rpc/service-urls';
import { SERVICE_URLS } from '../rpc/service-urls';

/**
 * Forwards one browser oRPC call to its service, rewriting `/api/rpc/<service>/*` to
 * `<service origin>/rpc/*`. Browser traffic can't reach services directly (private network in
 * production), so it always round-trips through this same-origin proxy; the browser's own call to
 * this route is same-origin, but the service on the other side has no notion of the app's sealed
 * `en_session` cookie — this route's own ambient session is the one thing that does, so it mints
 * and attaches the same s2s token a server-side call would.
 */
export async function sendRPCRequest(request: Request, service: ServiceName): Promise<Response> {
  const incoming = new URL(request.url);

  const prefix = `/api/rpc/${service}`;

  const target = new URL(
    incoming.pathname.replace(prefix, '/rpc') + incoming.search,
    SERVICE_URLS[service],
  );

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  const headers = new Headers(request.headers);

  const actingUserID = await loadSessionActor();

  const token = await createEdgeServiceToken({ actingUserID, audience: service });

  headers.set('authorization', `Bearer ${token}`);

  return fetch(target, {
    headers,
    method: request.method,
    ...(hasBody && { body: await request.blob() }),
  });
}
