import { isSpanContextValid, trace } from '@opentelemetry/api';
import type { TraceContext } from '@vers/trace';

export function findSpanTraceContext(): TraceContext | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();

  if (spanContext === undefined || !isSpanContextValid(spanContext)) {
    return undefined;
  }

  return { spanID: spanContext.spanId, traceID: spanContext.traceId };
}
