import type { TraceContext } from './types';

export function buildTraceparent(trace: Readonly<TraceContext>): string {
  return `00-${trace.traceID}-${trace.spanID}-01`;
}
