import { act } from '@testing-library/react';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly release: (value: T) => Promise<void>;
}

/**
 * A promise a test controls: `promise` stays pending until `release`. `release` resolves it inside
 * `act`, so state a React consumer updates from the promise's own continuation — a microtask outside
 * React's batching that `waitFor` races — is settled before the next assertion.
 */
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
