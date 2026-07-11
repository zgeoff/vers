import { traceStorage } from './trace-storage';
import type { TraceContext } from './types';

/**
 * The active request's trace context; undefined outside a `withTraceContext` scope (boot code,
 * timers, tests that never entered a request).
 */
export function findTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}
