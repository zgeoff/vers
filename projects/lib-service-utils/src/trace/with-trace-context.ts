import { traceStorage } from './trace-storage';
import type { TraceContext } from './types';

/**
 * Runs the given scope with the trace context active, making it visible to `findTraceContext`
 * across every await inside it.
 */
export function withTraceContext<T>(trace: Readonly<TraceContext>, scope: () => T): T {
  return traceStorage.run(trace, scope);
}
