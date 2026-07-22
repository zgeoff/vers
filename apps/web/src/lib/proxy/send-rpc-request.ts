import type { ServiceName } from '@vers/service-auth';
import { findSpanTraceContext, findTraceContext } from '@vers/service-utils';
import { buildTraceparent, createTraceContext } from '@vers/trace';
import { recordServiceCallFailure } from '../metrics/record-service-call-failure';
import { createEdgeServiceToken } from '../rpc/create-edge-service-token';
import { loadSessionActor } from '../rpc/load-session-actor';
import { DEFAULT_ATTEMPT_TIMEOUTS_MS } from '../rpc/make-bounded-fetch';
import type { ServiceFetchInit } from '../rpc/service-dispatcher';
import { serviceDispatcher } from '../rpc/service-dispatcher';
import { SERVICE_URLS } from '../rpc/service-urls';

const DEFAULT_TIMEOUT_BOUND_MS = Math.max(...DEFAULT_ATTEMPT_TIMEOUTS_MS);

/**
 * Forwards one browser oRPC call to its service, rewriting `/api/rpc/<service>/*` to
 * `<service origin>/rpc/*`. Browser traffic can't reach services directly (private network in
 * production), so it always round-trips through this same-origin proxy; the browser's own call to
 * this route is same-origin, but the service on the other side has no notion of the app's sealed
 * `en_session` cookie — this route's own ambient session is the one thing that does, so it mints
 * and attaches the same s2s token a server-side call would.
 */
export async function sendRPCRequest(
  request: Request,
  service: ServiceName,
  timeoutBoundMs = DEFAULT_TIMEOUT_BOUND_MS,
): Promise<Response> {
  const incoming = new URL(request.url);

  const prefix = `/api/rpc/${service}`;

  const target = new URL(
    incoming.pathname.replace(prefix, '/rpc') + incoming.search,
    SERVICE_URLS[service],
  );

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let body: Blob | undefined;

  if (hasBody) {
    try {
      body = await request.blob();
    } catch (error) {
      // a caller that aborted mid-flight leaves its body stream unreadable — nothing is waiting
      // for this response, so answer with 499 (client closed request) instead of letting the
      // read failure escape as a server fault
      if (request.signal.aborted) {
        return new Response(null, { status: 499 });
      }

      throw error;
    }
  }

  const headers = new Headers(request.headers);

  const actor = await loadSessionActor();

  const token = await createEdgeServiceToken({
    actingSessionID: actor?.sessionID ?? null,
    actingUserID: actor?.userID ?? null,
    audience: service,
  });

  headers.set('authorization', `Bearer ${token}`);

  // the browser's own traceparent names this hop's span id, not the service's — re-injecting from
  // this proxy's active context (continued from that same trace by `withRequestTrace`) parents the
  // service's span to app-web's server span instead of making it a sibling of the browser's
  const trace = findSpanTraceContext() ?? findTraceContext() ?? createTraceContext();

  headers.set('traceparent', buildTraceparent(trace));

  // a single attempt, unretried: buildQueryClient already retries network failures and 5xx twice
  // on this call's way back to the browser, so a second retry layer here would stack attempts
  const controller = new AbortController();

  const signal = AbortSignal.any([request.signal, controller.signal]);
  let boundFired = false;

  const timer = setTimeout(() => {
    boundFired = true;

    controller.abort();
  }, timeoutBoundMs);

  let response: Response;

  try {
    const requestInit: ServiceFetchInit = {
      dispatcher: serviceDispatcher,
      headers,
      method: request.method,
      signal,
      ...(body !== undefined && { body }),
    };

    // the timer is cleared the instant `fetch` resolves so the bound never outlives the response
    // headers — otherwise it stays armed through a streamed body read and can truncate it
    response = await fetch(target, requestInit);

    clearTimeout(timer);
  } catch (error) {
    clearTimeout(timer);

    if (request.signal.aborted) {
      throw error;
    }

    const reason = boundFired ? 'timeout' : 'transport';

    recordServiceCallFailure(service, reason);

    return new Response(null, { status: 503 });
  }

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
