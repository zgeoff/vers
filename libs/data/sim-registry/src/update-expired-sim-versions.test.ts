import { expect, test } from 'bun:test';
import type { DB } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { createSimVersionRow } from './test-utils/create-sim-version-row';
import { updateExpiredSimVersions } from './update-expired-sim-versions';

async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it tombstones and returns only active rows past their retention deadline', async () => {
  await using ctx = await setupTest();

  const expired = await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2020-01-01T00:00:00Z'),
    engineHash: 'hash_expired',
    retainedUntil: new Date('2020-01-01T00:00:00Z'),
    status: 'active',
  });

  const notExpired = await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-01-01T00:00:00Z'),
    engineHash: 'hash_kept',
    retainedUntil: new Date('2099-01-01T00:00:00Z'),
    status: 'active',
  });

  const tombstoned = await updateExpiredSimVersions(ctx.db);

  expect(tombstoned).toStrictEqual([{ ...expired, status: 'pruned' }]);

  const remaining = await ctx.db
    .selectFrom('simVersions')
    .select('status')
    .where('engineHash', '=', notExpired.engineHash)
    .executeTakeFirstOrThrow();

  expect(remaining.status).toBe('active');
});

test('it never tombstones the current version, even past its retention deadline', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-02-01T00:00:00Z'),
    engineHash: 'hash_current',
    retainedUntil: new Date('2020-01-01T00:00:00Z'),
    status: 'active',
  });

  const tombstoned = await updateExpiredSimVersions(ctx.db);

  expect(tombstoned).toBeEmpty();

  const remaining = await ctx.db
    .selectFrom('simVersions')
    .select('status')
    .where('engineHash', '=', current.engineHash)
    .executeTakeFirstOrThrow();

  expect(remaining.status).toBe('active');
});

test('it protects a lone active row past its retention deadline, since it is the current version by default', async () => {
  await using ctx = await setupTest();

  const lone = await createSimVersionRow(ctx.db, {
    engineHash: 'hash_lone',
    retainedUntil: new Date('2020-01-01T00:00:00Z'),
    status: 'active',
  });

  const tombstoned = await updateExpiredSimVersions(ctx.db);

  expect(tombstoned).toBeEmpty();

  const remaining = await ctx.db
    .selectFrom('simVersions')
    .select('status')
    .where('engineHash', '=', lone.engineHash)
    .executeTakeFirstOrThrow();

  expect(remaining.status).toBe('active');
});

test('it never re-returns a row a prior sweep already pruned', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, {
    engineHash: 'hash_already_pruned',
    retainedUntil: new Date('2020-01-01T00:00:00Z'),
    status: 'pruned',
  });

  const tombstoned = await updateExpiredSimVersions(ctx.db);

  expect(tombstoned).toBeEmpty();
});
