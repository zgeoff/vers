import { expect, test } from 'bun:test';
import postgres from 'postgres';
import { isPGError } from './is-pg-error';

test('it returns true for postgres errors', () => {
  const error = new postgres.PostgresError(
    'duplicate key value violates unique constraint "users_email_unique"',
  );

  error.code = '23505';
  error.constraint_name = 'users_email_unique';

  expect(isPGError(error)).toBeTrue();
});

test('it returns false for non-postgres errors', () => {
  const error = new Error('test error');

  expect(isPGError(error)).toBeFalse();
});
