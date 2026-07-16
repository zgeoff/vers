import type { TraceContext } from '@vers/trace';
import { traceStorage } from './trace-storage';

/**
 * The active request's trace context; undefined outside a `withTraceContext` scope (boot code,
 * timers, tests that never entered a request).
 */
export function findTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}
