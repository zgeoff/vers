import { expect, test } from 'bun:test';
import type { DB } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { removeExpiredSimVersions } from './remove-expired-sim-versions';
import { createSimVersionRow } from './test-utils/create-sim-version-row';

async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it removes and returns only rows past their retention deadline', async () => {
  await using ctx = await setupTest();

  const expired = await createSimVersionRow(ctx.db, {
    engineHash: 'hash_expired',
    retainedUntil: new Date('2020-01-01T00:00:00Z'),
    status: 'pruned',
  });

  const notExpired = await createSimVersionRow(ctx.db, {
    engineHash: 'hash_kept',
    retainedUntil: new Date('2099-01-01T00:00:00Z'),
    status: 'pruned',
  });

  const removed = await removeExpiredSimVersions(ctx.db);

  expect(removed).toStrictEqual([expired]);

  const remaining = await ctx.db
    .selectFrom('simVersions')
    .select('engineHash')
    .where('engineHash', '=', notExpired.engineHash)
    .executeTakeFirst();

  expect(remaining).toBeDefined();
});

test('it never removes the current version, even past its retention deadline', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-02-01T00:00:00Z'),
    engineHash: 'hash_current',
    retainedUntil: new Date('2020-01-01T00:00:00Z'),
    status: 'active',
  });

  const removed = await removeExpiredSimVersions(ctx.db);

  expect(removed).toBeEmpty();

  const remaining = await ctx.db
    .selectFrom('simVersions')
    .select('engineHash')
    .where('engineHash', '=', current.engineHash)
    .executeTakeFirst();

  expect(remaining).toBeDefined();
});

test('it removes an expired row even when no version is active', async () => {
  await using ctx = await setupTest();

  const expired = await createSimVersionRow(ctx.db, {
    engineHash: 'hash_expired',
    retainedUntil: new Date('2020-01-01T00:00:00Z'),
    status: 'pruned',
  });

  const removed = await removeExpiredSimVersions(ctx.db);

  expect(removed).toStrictEqual([expired]);
});
