import { isSpanContextValid, trace } from '@opentelemetry/api';
import type { TraceContext } from '@vers/trace';

/**
 * The active OpenTelemetry span's identity as a `TraceContext`; undefined outside a span (no
 * tracer provider registered, or the current path was excluded from tracing). Once a span is
 * active, it is the source of truth for the request's trace and span ids — log `traceID`,
 * `x-trace-id`, and outbound `traceparent` all derive from it, so they always match the exported
 * spans.
 */
export function findSpanTraceContext(): TraceContext | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();

  if (spanContext === undefined || !isSpanContextValid(spanContext)) {
    return undefined;
  }

  return { spanID: spanContext.spanId, traceID: spanContext.traceId };
}
