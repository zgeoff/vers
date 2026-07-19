import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { createTraceContext } from '@vers/trace';
import { findSpanTraceContext } from './find-span-trace-context';
import { withTraceContext } from './with-trace-context';

/**
 * Runs `scope` at the root of a fresh trace: a worker iteration, a boot drain, a scheduled sweep,
 * one queued job — anything with no inbound request to continue. Opens a span (a no-op when no
 * tracer provider is registered) and derives the scope's `TraceContext` from it, so log lines and
 * outbound service calls inside `scope` correlate with the exported span; a thrown error marks the
 * span failed before it rethrows.
 */
export function withRootSpan<T>(name: string, scope: () => Promise<T>): Promise<T> {
  const tracer = trace.getTracer('@vers/service-utils');

  return tracer.startActiveSpan(name, { kind: SpanKind.INTERNAL }, async (span) => {
    try {
      return await withTraceContext(findSpanTraceContext() ?? createTraceContext(), scope);
    } catch (error) {
      const exception = error instanceof Error ? error : String(error);

      span.recordException(exception);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
