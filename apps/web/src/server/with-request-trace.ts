import { SpanKind, SpanStatusCode, context, propagation, trace } from '@opentelemetry/api';
import { findSpanTraceContext, withTraceContext } from '@vers/service-utils';
import { createTraceContext, parseTraceparent } from '@vers/trace';

const ASSET_PATH_PATTERN = /\.[a-z0-9]+$/i;

export function withRequestTrace(
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  const pathname = new URL(request.url).pathname;

  if (pathname === '/health' || ASSET_PATH_PATTERN.test(pathname)) {
    return runWithoutSpan(request, next);
  }

  return runWithServerSpan(request, pathname, next);
}

function runWithoutSpan(request: Request, next: () => Promise<Response>): Promise<Response> {
  const traceContext = resolveTraceContext(request);

  return withTraceContext(traceContext, () => withTraceIDHeader(traceContext.traceID, next));
}

function runWithServerSpan(
  request: Request,
  pathname: string,
  next: () => Promise<Response>,
): Promise<Response> {
  const tracer = trace.getTracer('app-web');
  const carrier = Object.fromEntries(request.headers.entries());
  const parentContext = propagation.extract(context.active(), carrier);

  // The middleware sees no matched-route template, so the span keeps the low-cardinality
  // `HTTP <method>` fallback name and carries the concrete path only as the `url.path` attribute.
  return tracer.startActiveSpan(
    `HTTP ${request.method}`,
    {
      attributes: { 'http.method': request.method, 'url.path': pathname },
      kind: SpanKind.SERVER,
    },
    parentContext,
    async (span) => {
      const traceContext = resolveTraceContext(request);

      try {
        return await withTraceContext(traceContext, async () => {
          const response = await withTraceIDHeader(traceContext.traceID, next);

          span.setAttribute('http.status_code', response.status);

          if (response.status >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR });
          }

          return response;
        });
      } catch (error) {
        const exception = error instanceof Error ? error : String(error);

        span.recordException(exception);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

function resolveTraceContext(request: Request) {
  return (
    findSpanTraceContext() ??
    createTraceContext(parseTraceparent(request.headers.get('traceparent')) ?? undefined)
  );
}

async function withTraceIDHeader(
  traceID: string,
  next: () => Promise<Response>,
): Promise<Response> {
  const response = await next();

  try {
    response.headers.set('x-trace-id', traceID);
  } catch {
    // a response built by Response.redirect or Response.error carries immutable headers; those
    // still correlate through the request log lines, so pass them through unstamped
  }

  return response;
}
