import postgres from 'postgres';
import { expect, test } from 'vitest';
import { isUniqueConstraintError } from './is-unique-constraint-error';

test('it returns true for unique constraint violations', () => {
  const error = new postgres.PostgresError(
    'duplicate key value violates unique constraint "users_email_unique"',
  );

  error.code = '23505';
  error.constraint_name = 'users_email_unique';

  expect(isUniqueConstraintError(error, 'users_email_unique')).toBeTrue();
});

test('it returns false for non-matching constraint names', () => {
  const error = new postgres.PostgresError(
    'duplicate key value violates unique constraint "users_email_unique"',
  );

  error.code = '23505';
  error.constraint_name = 'users_email_unique';

  expect(isUniqueConstraintError(error, 'users_username_unique')).toBeFalse();
});

test('it returns false for non-unique constraint errors', () => {
  const error = new postgres.PostgresError(
    'insert or update on table "users" violates foreign key constraint "users_email_fkey"',
  );

  error.code = '23503'; // foreign key violation

  expect(isUniqueConstraintError(error, 'users_email_unique')).toBeFalse();
});

test('it returns false for other postgres errors', () => {
  const error = new postgres.PostgresError('undefined table "users_email_unique"');

  error.code = '42P01'; // undefined table

  expect(isUniqueConstraintError(error, 'users_email_unique')).toBeFalse();
});
