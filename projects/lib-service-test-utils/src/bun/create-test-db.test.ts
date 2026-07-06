import { expect, test } from 'bun:test';
import { sql } from 'kysely';
import { createTestDB } from './create-test-db';
import { createTestUser } from './create-test-user';

test('it defaults to transaction isolation: writes roll back once disposed', async () => {
  let userId: string;

  {
    await using testDB = await createTestDB();
    const { user } = await createTestUser(testDB.db, { email: 'repo-default@test.com' });

    userId = user.id;
  }

  await using verify = await createTestDB();

  const row = await verify.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', userId)
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
