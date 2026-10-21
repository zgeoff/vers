import { expect, test } from 'bun:test';
import { sql } from 'kysely';
import { z } from 'zod';
import { createTestUser } from '../create-test-user';
import { createDatabaseTestDB } from './create-database-test-db';

test('it clones a fresh database on every acquisition', async () => {
  await using first = await createDatabaseTestDB();

  const firstResult = await sql`select current_database()`.execute(first.db);

  await using second = await createDatabaseTestDB();

  const secondResult = await sql`select current_database()`.execute(second.db);

  const [firstRow] = z.tuple([z.object({ currentDatabase: z.string() })]).parse(firstResult.rows);
  const [secondRow] = z.tuple([z.object({ currentDatabase: z.string() })]).parse(secondResult.rows);

  expect(secondRow.currentDatabase).not.toBe(firstRow.currentDatabase);
});

test('it round-trips a real, committed write through the handle', async () => {
  await using testDB = await createDatabaseTestDB();

  const created = await createTestUser(testDB.db, { email: 'committed@test.com' });

  const row = await testDB.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', created.user.id)
    .executeTakeFirstOrThrow();

  expect(row.email).toBe('committed@test.com');
});
