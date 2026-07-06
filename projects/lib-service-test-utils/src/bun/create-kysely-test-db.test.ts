import { expect, test } from 'bun:test';
import { createKyselyTestDB } from './create-kysely-test-db';
import { createTestUser } from './create-test-user';

test('it clones the template db and round-trips a row through kysely under bun test', async () => {
  await using testDB = await createKyselyTestDB();

  const { user } = await createTestUser(testDB.db, { email: 'smoke@example.com' });

  const row = await testDB.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.email).toEqual('smoke@example.com');
  expect(row.username).toBeString();
  expect(Object.keys(row)).toIncludeSameMembers(Object.keys(user));
});

test('it returns the cloned database url', async () => {
  await using testDB = await createKyselyTestDB();

  expect(testDB.databaseURL).toBeString();
  expect(testDB.databaseURL).toInclude('test_');
});
