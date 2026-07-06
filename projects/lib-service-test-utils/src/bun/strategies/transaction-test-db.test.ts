import { expect, test } from 'bun:test';
import { sql } from 'kysely';
import { createTestUser } from '../create-test-user';
import { createTransactionTestDB } from './transaction-test-db';

test('it rolls back everything written through the handle once disposed', async () => {
  let userId: string;

  {
    await using testDB = await createTransactionTestDB();
    const { user } = await createTestUser(testDB.db, { email: 'rollback-proof@test.com' });

    userId = user.id;
  }

  await using verify = await createTransactionTestDB();

  const row = await verify.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', userId)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it reuses the same underlying database across acquisitions', async () => {
  await using first = await createTransactionTestDB();

  const firstResult = await sql<{ currentDatabase: string }>`select current_database()`.execute(
    first.db,
  );

  await using second = await createTransactionTestDB();

  const secondResult = await sql<{ currentDatabase: string }>`select current_database()`.execute(
    second.db,
  );

  expect(secondResult.rows[0]?.currentDatabase).toBe(firstResult.rows[0]?.currentDatabase);
});
