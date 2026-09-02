import invariant from 'tiny-invariant';

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
