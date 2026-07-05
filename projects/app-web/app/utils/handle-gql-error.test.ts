import { CombinedError } from '@urql/core';
import { expect, test } from 'vitest';
import { handleGQLError } from './handle-gql-error';

test('it rethrows redirects', () => {
  const error = new CombinedError({
    // @ts-expect-error - networkError is typed as an Error
    networkError: new Response('Redirect', { status: 302 }),
  });

  // oxlint-disable-next-line typescript/no-confusing-void-expression -- baseline(#236)
  expect(() => handleGQLError(error)).toThrow(
    // oxlint-disable-next-line typescript/no-unsafe-argument -- baseline(#236)
    expect.objectContaining({
      status: 302,
    }),
  );
});

test('it does nothing if the network error is not a redirect', () => {
  const error = new CombinedError({
    networkError: new Error('Not found'),
  });

  // oxlint-disable-next-line typescript/no-confusing-void-expression -- baseline(#236)
  expect(() => handleGQLError(error)).not.toThrow();
});
