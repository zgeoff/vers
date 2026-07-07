import { expect, test } from 'vitest';
import { createTestDB } from './test-support/create-test-db';

test('it round-trips a row through camelCase-mapped columns', async () => {
  await using handle = await createTestDB();

  const db = handle.db;

  const inserted = await db
    .insertInto('users')
    .values({
      email: 'create-db@test.com',
      id: 'usr_create_db_test',
      name: 'Create DB Test User',
      username: 'create_db_test_user',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(inserted.createdAt).toBeInstanceOf(Date);
  expect(inserted.passwordHash).toBeNull();

  const user = await db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', 'create-db@test.com')
    .executeTakeFirstOrThrow();

  expect(user.id).toBe('usr_create_db_test');
  expect(user.username).toBe('create_db_test_user');
  expect(user.createdAt).toBeInstanceOf(Date);
});
