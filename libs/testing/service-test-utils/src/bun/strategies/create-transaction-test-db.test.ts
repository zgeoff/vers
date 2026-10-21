import { expect, test } from 'bun:test';
import { sql } from 'kysely';
import { z } from 'zod';
import { createTestUser } from '../create-test-user';
import { createTransactionTestDB } from './create-transaction-test-db';

test('it rolls back everything written through the handle once disposed', async () => {
  const written = await createTransactionTestDB();
  const created = await createTestUser(written.db, { email: 'rollback-proof@test.com' });

  await written[Symbol.asyncDispose]();

  await using verify = await createTransactionTestDB();

  const row = await verify.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', created.user.id)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it reuses the same underlying database across acquisitions', async () => {
  await using first = await createTransactionTestDB();

  const firstResult = await sql`select current_database()`.execute(first.db);

  await using second = await createTransactionTestDB();

  const secondResult = await sql`select current_database()`.execute(second.db);

  const [firstRow] = z.tuple([z.object({ currentDatabase: z.string() })]).parse(firstResult.rows);
  const [secondRow] = z.tuple([z.object({ currentDatabase: z.string() })]).parse(secondResult.rows);

  expect(secondRow.currentDatabase).toBe(firstRow.currentDatabase);
});
