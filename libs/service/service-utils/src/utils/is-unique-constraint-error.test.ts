import { expect, test } from 'bun:test';
import postgres from 'postgres';
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

  // foreign key violation
  error.code = '23503';

  expect(isUniqueConstraintError(error, 'users_email_unique')).toBeFalse();
});

test('it returns false for other postgres errors', () => {
  const error = new postgres.PostgresError('undefined table "users_email_unique"');

  // undefined table
  error.code = '42P01';

  expect(isUniqueConstraintError(error, 'users_email_unique')).toBeFalse();
});
