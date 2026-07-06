import { expect, test } from 'bun:test';
import { sql } from 'kysely';
import { createTestDB } from './create-test-db';
import { createTestUser } from './create-test-user';

test('it defaults to transaction isolation: writes roll back once disposed', async () => {
  const written = await createTestDB();
  const { user } = await createTestUser(written.db, { email: 'repo-default@test.com' });

  await written[Symbol.asyncDispose]();

  await using verify = await createTestDB();

  const row = await verify.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it opts into database isolation on request', async () => {
  await using testDB = await createTestDB({ isolation: 'database' });

  const result = await sql<{ currentDatabase: string }>`select current_database()`.execute(
    testDB.db,
  );

  expect(result.rows[0]?.currentDatabase).toStartWith('test_');
});
