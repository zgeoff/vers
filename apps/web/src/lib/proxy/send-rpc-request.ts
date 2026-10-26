import type { ServiceName } from '@vers/service-auth';
import { findSpanTraceContext, findTraceContext } from '@vers/service-utils';
import { buildSessionSupersededResponse } from '@vers/service-utils/orpc';
import { buildTraceparent, createTraceContext } from '@vers/trace';
import { createEdgeServiceToken } from '../rpc/create-edge-service-token';
import { loadSessionActor } from '../rpc/load-session-actor';
import { runBoundedAttempts } from '../rpc/run-bounded-attempts';
import { serviceDispatcher } from '../rpc/service-dispatcher';
import { SERVICE_URLS } from '../rpc/service-urls';
import type { AttemptClock, ServiceFetchInit } from '../rpc/types';
import { isProxiedService } from './is-proxied-service';
import { isRetryableProxyCall } from './is-retryable-proxy-call';

export interface SendRPCRequestOptions {
  readonly clock?: AttemptClock;
}

export async function sendRPCRequest(
  request: Request,
  service: ServiceName,
  options: Readonly<SendRPCRequestOptions> = {},
): Promise<Response> {
  if (!isProxiedService(service)) {
    return new Response(null, { status: 404 });
  }

  const incoming = new URL(request.url);

  const prefix = `/api/rpc/${service}`;

  const target = new URL(
    incoming.pathname.replace(prefix, '/rpc') + incoming.search,
    SERVICE_URLS[service],
  );

  const procedurePath = incoming.pathname
    .slice(prefix.length)
    .split('/')
    .filter((segment) => segment !== '');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let body: ArrayBuffer | undefined;

  if (hasBody) {
    try {
      // Node 24's fetch streams a Blob body through a native reader that it never releases, and
      // the reader keeps the request's async context alive: a load run lost about 30 KB of heap
      // per proxied call until app-web died at its heap limit. A byte body sends without a reader.
      body = await request.arrayBuffer();
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
    return buildSessionSupersededResponse();
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

  const attempts = await runBoundedAttempts(
    {
      ...(options.clock !== undefined && { clock: options.clock }),
      retryable: isRetryableProxyCall(service, procedurePath),
      service,
      signal: request.signal,
    },
    (signal) => {
      const requestInit: ServiceFetchInit = {
        dispatcher: serviceDispatcher,
        headers,
        method: request.method,
        signal,
        ...(body !== undefined && { body }),
      };

      return fetch(target, requestInit);
    },
  );

  if (attempts.kind === 'aborted') {
    throw attempts.cause;
  }

  if (attempts.kind === 'failed') {
    return new Response(null, { status: 503 });
  }

  const response = attempts.response;

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
