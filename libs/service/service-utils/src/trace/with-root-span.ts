import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { createTraceContext } from '@vers/trace';
import { findSpanTraceContext } from './find-span-trace-context';
import { withTraceContext } from './with-trace-context';

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
