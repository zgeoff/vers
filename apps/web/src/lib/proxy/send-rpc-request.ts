import type { ServiceName } from '@vers/service-auth';
import { findSpanTraceContext, findTraceContext } from '@vers/service-utils';
import { buildTraceparent, createTraceContext } from '@vers/trace';
import { recordServiceCallFailure } from '../metrics/record-service-call-failure';
import { createEdgeServiceToken } from '../rpc/create-edge-service-token';
import { loadSessionActor } from '../rpc/load-session-actor';
import { DEFAULT_ATTEMPT_TIMEOUTS_MS } from '../rpc/make-bounded-fetch';
import { serviceDispatcher } from '../rpc/service-dispatcher';
import { SERVICE_URLS } from '../rpc/service-urls';
import type { ServiceFetchInit } from '../rpc/types';

const DEFAULT_TIMEOUT_BOUND_MS = Math.max(...DEFAULT_ATTEMPT_TIMEOUTS_MS);

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

  const outcome = await loadSessionActor();

  // a session deleted before its expiry is answered here, not forwarded: only this side can tell a
  // deletion from an expiry, and the header tells the caller to discard its offline work. A plain
  // expiry gets the service's own 401 with no header, so the caller keeps that work.
  if (outcome.kind === 'superseded') {
    return new Response(null, { headers: { 'x-session-superseded': '1' }, status: 401 });
  }

  const actor = outcome.kind === 'actor' ? outcome : null;

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

  // fetch responses carry immutable headers the server framework must still finalize, so rewrap
  // into a mutable response. Copy headers entry by entry: another runtime's Headers instance passed
  // to the constructor can yield an empty copy. The body is already decoded.
  const responseHeaders = new Headers([...response.headers]);

  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  return new Response(response.body, {
    headers: responseHeaders,
    status: response.status,
    statusText: response.statusText,
  });
}
