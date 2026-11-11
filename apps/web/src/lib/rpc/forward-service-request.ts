import type { ServiceName } from '@vers/service-auth';
import { findSpanTraceContext, findTraceContext } from '@vers/service-utils';
import { buildTraceparent, createTraceContext } from '@vers/trace';
import { runBoundedAttempts } from './run-bounded-attempts';
import { serviceDispatcher } from './service-dispatcher';
import type { AttemptClock, ServiceFetchInit } from './types';

export interface ForwardServiceRequestOptions {
  readonly clock?: AttemptClock;
  readonly retryable: boolean;
  readonly service: ServiceName;
  readonly target: URL;
  readonly token: string;
}

export async function forwardServiceRequest(
  request: Request,
  options: Readonly<ForwardServiceRequestOptions>,
): Promise<Response> {
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

  headers.set('authorization', `Bearer ${options.token}`);

  // the caller's own traceparent names its hop's span id, not the service's — re-injecting from
  // this edge's active context (continued from that same trace by `withRequestTrace`) parents the
  // service's span to app-web's server span instead of making it a sibling of the caller's
  const trace = findSpanTraceContext() ?? findTraceContext() ?? createTraceContext();

  headers.set('traceparent', buildTraceparent(trace));

  const attempts = await runBoundedAttempts(
    {
      ...(options.clock !== undefined && { clock: options.clock }),
      retryable: options.retryable,
      service: options.service,
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

      return fetch(options.target, requestInit);
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
