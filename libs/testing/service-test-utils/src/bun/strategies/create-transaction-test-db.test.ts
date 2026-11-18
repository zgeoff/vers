import { expect, onTestFinished, test } from 'bun:test';
import { sql } from 'kysely';
import postgres from 'postgres';
import { z } from 'zod';
import { createTestUser } from '../create-test-user';
import { releaseWorkerClones } from '../register-worker-clone';
import { resolveTestDBTarget } from '../resolve-test-db-target';
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

test('it drops the worker database on release and builds a new one for the next acquisition', async () => {
  const admin = postgres(`${resolveTestDBTarget().baseURI}/postgres`);

  onTestFinished(() => admin.end());

  const first = await createTransactionTestDB();
  const firstResult = await sql`select current_database()`.execute(first.db);

  const [firstRow] = z.tuple([z.object({ currentDatabase: z.string() })]).parse(firstResult.rows);

  await first[Symbol.asyncDispose]();

  await releaseWorkerClones();

  const dropped =
    await admin`SELECT 1 FROM pg_database WHERE datname = ${firstRow.currentDatabase}`;

  expect(dropped).toBeEmpty();

  await using second = await createTransactionTestDB();

  const secondResult = await sql`select current_database()`.execute(second.db);

  const [secondRow] = z.tuple([z.object({ currentDatabase: z.string() })]).parse(secondResult.rows);

  expect(secondRow.currentDatabase).not.toBe(firstRow.currentDatabase);
});
