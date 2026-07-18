import { SpanKind, SpanStatusCode, context, propagation, trace } from '@opentelemetry/api';
import { findSpanTraceContext, withTraceContext } from '@vers/service-utils';
import { createTraceContext, parseTraceparent } from '@vers/trace';

const ASSET_PATH_PATTERN = /\.[a-z0-9]+$/i;

/**
 * Runs the request inside its W3C trace-context scope. A served static asset (a pathname with a
 * file extension) or the `/health` probe — mirroring `makeRequestLogger`'s debug-path list — skips
 * opening a span; every other request opens a SERVER span extracted from the inbound headers, a
 * no-op without a registered tracer provider. The stored `TraceContext` derives from that span when
 * it continued or started a real trace; otherwise (no span, or no tracer provider registered) it
 * falls back to parsing the inbound `traceparent` directly, or starts a fresh trace for this hop —
 * so a support report can always name the trace from `x-trace-id`, with or without OTel wired.
 */
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

/**
 * Resolves the request's trace context: from the active span when one continued or started a real
 * trace, otherwise a valid inbound `traceparent` parsed directly, or a fresh trace for this hop.
 */
function resolveTraceContext(request: Request) {
  return (
    findSpanTraceContext() ??
    createTraceContext(parseTraceparent(request.headers.get('traceparent')) ?? undefined)
  );
}

/**
 * Runs `next` and stamps its response with the request's trace id, tolerating the immutable
 * headers a `Response.redirect`/`Response.error` carries.
 */
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
