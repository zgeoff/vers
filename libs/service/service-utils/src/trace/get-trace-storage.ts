// oxlint-disable-next-line no-restricted-imports -- the one sanctioned async_hooks import: the namespace form defers the browser stub's throwing property access to the accessor's first call
import * as asyncHooks from 'node:async_hooks';
import type { TraceContext } from '@vers/trace';

let storage: asyncHooks.AsyncLocalStorage<TraceContext> | undefined;

/**
 * Process-wide holder for the active request's trace context, created on first access. Written
 * only by `withTraceContext`; read anywhere via `findTraceContext` — including pino mixins, so
 * every log line inside a request carries its trace id without threading it through call
 * signatures.
 *
 * Construction is deferred to the call site, and the binding it constructs from is read through
 * a namespace import rather than a named one, so that importing this module — or anything that
 * re-exports it, like the `orpc` barrel — never touches `node:async_hooks` on its own. A
 * bundler that externalizes the builtin for the browser only throws when a property on it is
 * actually read; a browser bundle that never calls into a request scope never reads one.
 */
export function getTraceStorage(): asyncHooks.AsyncLocalStorage<TraceContext> {
  storage ??= new asyncHooks.AsyncLocalStorage<TraceContext>();

  return storage;
}
