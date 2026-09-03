import { act } from '@testing-library/react';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly release: (value: T) => Promise<void>;
}

// `release` resolves inside `act`: state a consumer updates from the promise's own continuation is
// a microtask outside React's batching that `waitFor` races, so it must settle before the next
// assertion
export function buildDeferred<T>(): Deferred<T> {
  const gate = Promise.withResolvers<T>();

  return {
    promise: gate.promise,
    release: (value) =>
      act(async () => {
        gate.resolve(value);

        await gate.promise;
      }),
  };
}
