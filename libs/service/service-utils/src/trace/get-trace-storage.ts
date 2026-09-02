// oxlint-disable-next-line no-restricted-imports -- the one sanctioned async_hooks import: the namespace form defers the browser stub's throwing property access to the accessor's first call
import * as asyncHooks from 'node:async_hooks';
import type { TraceContext } from '@vers/trace';

let storage: asyncHooks.AsyncLocalStorage<TraceContext> | undefined;

export function getTraceStorage(): asyncHooks.AsyncLocalStorage<TraceContext> {
  // construction is deferred to this call and reads through the namespace import, so importing
  // this module never touches node:async_hooks on its own; a bundler that externalizes the
  // builtin for the browser only throws when a property on it is actually read
  storage ??= new asyncHooks.AsyncLocalStorage<TraceContext>();

  return storage;
}
