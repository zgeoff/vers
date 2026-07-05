import { CombinedError } from '@urql/core';
import { expect, test } from 'vitest';
import { handleGQLError } from './handle-gql-error';

test('it rethrows redirects', () => {
  const error = new CombinedError({
    // @ts-expect-error - networkError is typed as an Error
    networkError: new Response('Redirect', { status: 302 }),
  });

  expect(() => handleGQLError(error)).toThrow(
    expect.objectContaining({
      status: 302,
    }),
  );
});

test('it does nothing if the network error is not a redirect', () => {
  const error = new CombinedError({
    networkError: new Error('Not found'),
  });

  expect(() => handleGQLError(error)).not.toThrow();
});
