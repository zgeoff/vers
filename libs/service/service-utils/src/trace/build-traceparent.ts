import type { TraceContext } from './types';

/**
 * Serializes a trace context as a W3C `traceparent` header, always flagged sampled so downstream
 * hops keep recording.
 */
export function buildTraceparent(trace: Readonly<TraceContext>): string {
  return `00-${trace.traceID}-${trace.spanID}-01`;
}
