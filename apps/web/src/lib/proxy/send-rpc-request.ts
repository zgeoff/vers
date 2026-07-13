import type { ServiceName } from '@vers/service-auth';
import { createEdgeServiceToken } from '../rpc/create-edge-service-token';
import { loadSessionActor } from '../rpc/load-session-actor';
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

  const actor = await loadSessionActor();

  const token = await createEdgeServiceToken({
    actingSessionID: actor?.sessionID ?? null,
    actingUserID: actor?.userID ?? null,
    audience: service,
  });

  headers.set('authorization', `Bearer ${token}`);

  const response = await fetch(target, {
    headers,
    method: request.method,
    ...(hasBody && { body: await request.blob() }),
  });

  // fetch responses carry immutable headers, which the server framework must still be able to
  // finalize (merge, drop stale encoding headers) — rewrap into a mutable response. Copy entry by
  // entry: passing another runtime's Headers instance to the constructor can yield an empty copy.
  // The body is already decoded, so the upstream encoding headers no longer describe it.
  const responseHeaders = new Headers([...response.headers]);

  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  return new Response(response.body, {
    headers: responseHeaders,
    status: response.status,
    statusText: response.statusText,
  });
}
