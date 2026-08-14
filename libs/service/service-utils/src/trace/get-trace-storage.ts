// oxlint-disable-next-line no-restricted-imports -- the one sanctioned async_hooks import: the namespace form defers the browser stub's throwing property access to the accessor's first call
import * as asyncHooks from 'node:async_hooks';
import type { TraceContext } from '@vers/trace';

let storage: asyncHooks.AsyncLocalStorage<TraceContext> | undefined;

/**
 * Process-wide holder for the active request's trace context, created on first access. Written
 * only by `withTraceContext`; read anywhere via `findTraceContext` — including pino mixins, so
 * every log line inside a request carries its trace id without threading it through call
 * signatures.
 */
export function getTraceStorage(): asyncHooks.AsyncLocalStorage<TraceContext> {
  // construction is deferred to this call site, and read through the namespace import above,
  // so importing this module — or anything that re-exports it, like the `orpc` barrel — never
  // touches `node:async_hooks` on its own; a bundler that externalizes the builtin for the
  // browser only throws when a property on it is actually read
  storage ??= new asyncHooks.AsyncLocalStorage<TraceContext>();

  return storage;
}
