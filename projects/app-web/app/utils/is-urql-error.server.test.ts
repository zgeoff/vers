import { CombinedError } from '@urql/core';
import { expect, test } from 'vitest';
import { isURQLError } from './is-urql-error.server';

test('it returns true if the error is a URQL error', () => {
  const urqlError = new CombinedError({});

  expect(isURQLError(urqlError)).toBeTrue();
});

test('it returns false if the error is not a URQL error', () => {
  const error = new Error('test');

  expect(isURQLError(error)).toBeFalse();
});
