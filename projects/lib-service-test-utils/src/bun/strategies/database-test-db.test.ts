import { expect, test } from 'bun:test';
import { sql } from 'kysely';
import { createTestUser } from '../create-test-user';
import { createDatabaseTestDB } from './database-test-db';

test('it clones a fresh database on every acquisition', async () => {
  await using first = await createDatabaseTestDB();

  const firstResult = await sql<{ currentDatabase: string }>`select current_database()`.execute(
    first.db,
  );

  await using second = await createDatabaseTestDB();

  const secondResult = await sql<{ currentDatabase: string }>`select current_database()`.execute(
    second.db,
  );

  expect(secondResult.rows[0]?.currentDatabase).not.toBe(firstResult.rows[0]?.currentDatabase);
});

test('it round-trips a real, committed write through the handle', async () => {
  await using testDB = await createDatabaseTestDB();
  const { user } = await createTestUser(testDB.db, { email: 'committed@test.com' });

  const row = await testDB.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.email).toBe('committed@test.com');
});
