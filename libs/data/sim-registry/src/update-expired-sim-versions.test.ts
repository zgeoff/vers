import { expect, test } from 'bun:test';
import type { DB } from '@vers/db';
import { createTestDB, createTestUser } from '@vers/service-test-utils/bun';
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

test('it refuses to tombstone an expired version that still pins appended-but-unverified work', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-02-01T00:00:00Z'),
    engineHash: 'hash_current',
    retainedUntil: new Date('2099-01-01T00:00:00Z'),
    status: 'active',
  });

  const pinned = await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2020-01-01T00:00:00Z'),
    engineHash: 'hash_pinned',
    retainedUntil: new Date('2020-01-01T00:00:00Z'),
    status: 'active',
  });

  const user = await createTestUser(ctx.db);

  const avatar = await ctx.db
    .insertInto('avatars')
    .values({ id: 'avatar_pinned', name: 'avatar-pinned', seed: 1, userId: user.user.id })
    .returningAll()
    .executeTakeFirstOrThrow();

  await ctx.db
    .insertInto('activities')
    .values({
      appendedHead: 3,
      avatarId: avatar.id,
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '0.0.0-dev',
      encounterNode: { difficulty: 1 },
      id: 'act_pinned',
      lastHash: 'hash_last',
      scopeId: 'node_1',
      scopeType: 'world_map_node',
      secretRef: 'worldmap',
      secretVersion: 1,
      seed: 'seed_1',
      simVersion: pinned.engineHash,
      startHash: 'hash_start',
      status: 'stopped',
      verifiedHead: 1,
    })
    .execute();

  const tombstoned = await updateExpiredSimVersions(ctx.db);

  expect(tombstoned).toBeEmpty();

  const remaining = await ctx.db
    .selectFrom('simVersions')
    .select('status')
    .where('engineHash', '=', pinned.engineHash)
    .executeTakeFirstOrThrow();

  expect(remaining.status).toBe('active');
});

test('it tombstones an expired version whose only unverified pinned work is rejected', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-02-01T00:00:00Z'),
    engineHash: 'hash_current',
    retainedUntil: new Date('2099-01-01T00:00:00Z'),
    status: 'active',
  });

  const expired = await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2020-01-01T00:00:00Z'),
    engineHash: 'hash_rejected_only',
    retainedUntil: new Date('2020-01-01T00:00:00Z'),
    status: 'active',
  });

  const user = await createTestUser(ctx.db);

  const avatar = await ctx.db
    .insertInto('avatars')
    .values({ id: 'avatar_rejected', name: 'avatar-rejected', seed: 1, userId: user.user.id })
    .returningAll()
    .executeTakeFirstOrThrow();

  await ctx.db
    .insertInto('activities')
    .values({
      appendedHead: 3,
      avatarId: avatar.id,
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '0.0.0-dev',
      encounterNode: { difficulty: 1 },
      id: 'act_rejected',
      lastHash: 'hash_last',
      scopeId: 'node_1',
      scopeType: 'world_map_node',
      secretRef: 'worldmap',
      secretVersion: 1,
      seed: 'seed_1',
      simVersion: expired.engineHash,
      startHash: 'hash_start',
      status: 'rejected',
      verifiedHead: 1,
    })
    .execute();

  const tombstoned = await updateExpiredSimVersions(ctx.db);

  expect(tombstoned).toStrictEqual([{ ...expired, status: 'pruned' }]);
});
