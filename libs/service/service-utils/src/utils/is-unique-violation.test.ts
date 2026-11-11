import { expect, test } from 'bun:test';
import postgres from 'postgres';
import { isUniqueViolation } from './is-unique-violation';

test('it returns true for a unique violation on any constraint', () => {
  const error = new postgres.PostgresError(
    'duplicate key value violates unique constraint "kettles_name_unique"',
  );

  error.code = '23505';

  expect(isUniqueViolation(error)).toBeTrue();
});

test('it returns false for another postgres error', () => {
  const error = new postgres.PostgresError(
    'insert or update on table "kettles" violates foreign key constraint "kettles_owner_fkey"',
  );

  error.code = '23503';

  expect(isUniqueViolation(error)).toBeFalse();
});

test.each([
  { error: null, label: 'null' },
  { error: 'duplicate key', label: 'a string' },
  { error: new Error('duplicate key'), label: 'an error with no code' },
])('it returns false for $label', (row) => {
  expect(isUniqueViolation(row.error)).toBeFalse();
});
