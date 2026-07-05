import { CombinedError } from '@urql/core';
import { expect, test } from 'vitest';
import { isURQLFetchError } from './is-urql-fetch-error.server';

test('it returns true if the error is a URQL fetch error', () => {
  const error = new CombinedError({
    response: new Response(),
  });

  expect(isURQLFetchError(error)).toBeTrue();
});

test('it returns false if the error is not a URQL fetch error', () => {
  const error = new Error('test');

  expect(isURQLFetchError(error)).toBeFalse();
});
