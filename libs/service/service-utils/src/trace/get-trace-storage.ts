import { AsyncLocalStorage } from 'node:async_hooks';
import type { TraceContext } from '@vers/trace';

let storage: AsyncLocalStorage<TraceContext> | undefined;

/**
 * Process-wide holder for the active request's trace context, created on first access. Written
 * only by `withTraceContext`; read anywhere via `findTraceContext` — including pino mixins, so
 * every log line inside a request carries its trace id without threading it through call
 * signatures.
 *
 * Construction is deferred to the call site so that importing this module — or anything that
 * re-exports it, like the `orpc` barrel — never touches `node:async_hooks` on its own. A
 * browser bundle that never calls into a request scope never runs this accessor.
 */
export function getTraceStorage(): AsyncLocalStorage<TraceContext> {
  storage ??= new AsyncLocalStorage<TraceContext>();

  return storage;
}
