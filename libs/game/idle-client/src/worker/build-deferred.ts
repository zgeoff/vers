import invariant from 'tiny-invariant';

/**
 * A promise a caller awaits, paired with the functions that settle it — the machine's coordination
 * primitive for a queued flow's result. Never serialized or persisted: purely in-memory, settled
 * exactly once, from whichever action decides the flow's outcome.
 */
export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly reject: (reason: unknown) => void;
  readonly resolve: (value: T) => void;
}

export function buildDeferred<T>(): Deferred<T> {
  let resolveDeferred: ((value: T) => void) | undefined;
  let rejectDeferred: ((reason: unknown) => void) | undefined;

  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });

  // the Promise constructor always calls its executor synchronously, so both are already assigned
  invariant(resolveDeferred !== undefined, 'the promise executor runs synchronously');
  invariant(rejectDeferred !== undefined, 'the promise executor runs synchronously');

  return { promise, reject: rejectDeferred, resolve: resolveDeferred };
}
