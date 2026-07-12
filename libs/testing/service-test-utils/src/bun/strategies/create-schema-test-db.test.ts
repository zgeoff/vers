import { expect, test } from 'bun:test';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import postgres from 'postgres';
import invariant from 'tiny-invariant';
import { createTestUser } from '../create-test-user';
import { resolveTestDBTarget } from '../resolve-test-db-target';
import { createSchemaTestDB } from './create-schema-test-db';

test('it commits real writes visible to a second connection onto the same clone', async () => {
  await using handle = await createSchemaTestDB();

  const created = await createTestUser(handle.db, { email: 'schema-commit@test.com' });
  const location = await getCloneLocation(handle.db);

  const raw = postgres(location.databaseURL, { connection: { search_path: location.searchPath } });

  try {
    const rows = await raw`select id from users where id = ${created.user.id}`;

    expect(rows).toHaveLength(1);
  } finally {
    await raw.end();
  }
});

test('it nests a db.transaction() call', async () => {
  await using handle = await createSchemaTestDB();

  await handle.db.transaction().execute(async (trx) => {
    await createTestUser(trx, { email: 'schema-nested@test.com' });
  });

  const row = await handle.db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', 'schema-nested@test.com')
    .executeTakeFirst();

  expect(row).toBeDefined();
});

test('it keeps the handle queryable after a caught unique violation', async () => {
  await using handle = await createSchemaTestDB();

  await createTestUser(handle.db, { email: 'schema-conflict@test.com' });

  expect(createTestUser(handle.db, { email: 'schema-conflict@test.com' })).rejects.toMatchObject({
    code: '23505',
  });

  const rows = await handle.db.selectFrom('users').selectAll().execute();

  expect(rows).toBeArray();
});

test('it fires the updated_at trigger on clone tables', async () => {
  await using handle = await createSchemaTestDB();

  const created = await createTestUser(handle.db, { email: 'schema-trigger@test.com' });

  const updated = await handle.db
    .updateTable('users')
    .set({ name: 'Updated Name' })
    .where('id', '=', created.user.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(updated.updatedAt).toBeAfter(created.user.updatedAt);
});

test('it isolates rows between two concurrently acquired clones', async () => {
  await using first = await createSchemaTestDB();
  await using second = await createSchemaTestDB();

  await createTestUser(first.db, { email: 'schema-clone-a@test.com' });
  await createTestUser(second.db, { email: 'schema-clone-b@test.com' });

  const seenFromFirst = await first.db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', 'schema-clone-b@test.com')
    .executeTakeFirst();

  const seenFromSecond = await second.db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', 'schema-clone-a@test.com')
    .executeTakeFirst();

  expect(seenFromFirst).toBeUndefined();
  expect(seenFromSecond).toBeUndefined();
});

test('it drops the clone schema once disposed', async () => {
  const handle = await createSchemaTestDB();
  const location = await getCloneLocation(handle.db);

  await handle[Symbol.asyncDispose]();

  const raw = postgres(location.databaseURL);

  try {
    const rows = await raw`select 1 from pg_namespace where nspname = ${location.searchPath}`;

    expect(rows).toHaveLength(0);
  } finally {
    await raw.end();
  }
});

test('it rejects a write that violates a cloned foreign key', async () => {
  await using handle = await createSchemaTestDB();

  expect(
    handle.db
      .insertInto('avatars')
      .values({ id: 'av_schema_fk_test', name: 'FK Test', userId: 'usr_missing' })
      .execute(),
  ).rejects.toMatchObject({ code: '23503' });
});

interface CloneLocation {
  readonly databaseURL: string;
  readonly searchPath: string;
}

/**
 * Resolves the clone's connection URL and `search_path` from inside the handle itself, for tests
 * that verify what a second, independent connection can see.
 */
async function getCloneLocation(db: Kysely<DB>): Promise<CloneLocation> {
  const target = resolveTestDBTarget();

  const dbNameResult = await sql<{ currentDatabase: string }>`select current_database()`.execute(
    db,
  );

  const searchPathResult = await sql<{ searchPath: string }>`show search_path`.execute(db);

  const currentDatabase = dbNameResult.rows[0]?.currentDatabase;
  const searchPath = searchPathResult.rows[0]?.searchPath;

  invariant(currentDatabase !== undefined, 'expected current_database() to return a row');
  invariant(searchPath !== undefined, 'expected show search_path to return a row');

  return { databaseURL: `${target.baseURI}/${currentDatabase}`, searchPath };
}
