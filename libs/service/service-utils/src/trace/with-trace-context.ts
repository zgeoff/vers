import type { TraceContext } from '@vers/trace';
import { getTraceStorage } from './get-trace-storage';

/**
 * Runs the given scope with the trace context active, making it visible to `findTraceContext`
 * across every await inside it.
 */
export function withTraceContext<T>(trace: Readonly<TraceContext>, scope: () => T): T {
  return getTraceStorage().run(trace, scope);
}
