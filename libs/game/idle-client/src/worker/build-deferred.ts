import invariant from 'tiny-invariant';

/**
 * A promise a caller awaits, paired with the function that settles it — the machine's coordination
 * primitive for a queued flow's result. Never serialized or persisted: purely in-memory, resolved
 * exactly once, from whichever action decides the flow's outcome.
 */
export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

export function buildDeferred<T>(): Deferred<T> {
  let resolveDeferred: ((value: T) => void) | undefined;

  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve;
  });

  // the Promise constructor always calls its executor synchronously, so this is already assigned
  invariant(resolveDeferred !== undefined, 'the promise executor runs synchronously');

  return { promise, resolve: resolveDeferred };
}
