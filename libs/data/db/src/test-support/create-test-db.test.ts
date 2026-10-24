import { expect, onTestFinished, test } from 'bun:test';
import { sql } from 'kysely';
import postgres from 'postgres';
import { z } from 'zod';
import { createTestDB } from './create-test-db';
import { resolveTestDBTarget } from './resolve-test-db-target';

test('it clones a migrated database from the template', async () => {
  await using handle = await createTestDB();

  const rows = await handle.db.selectFrom('users').selectAll().execute();

  expect(rows).toBeEmpty();
});

test('it drops the cloned database once disposed', async () => {
  const handle = await createTestDB();
  const result = await sql`select current_database()`.execute(handle.db);

  const [{ currentDatabase }] = z
    .tuple([z.object({ currentDatabase: z.string() })])
    .parse(result.rows);

  await handle[Symbol.asyncDispose]();

  const admin = postgres(`${resolveTestDBTarget().baseURI}/postgres`);

  onTestFinished(() => admin.end());

  const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${currentDatabase}`;

  expect(rows).toBeEmpty();
});
