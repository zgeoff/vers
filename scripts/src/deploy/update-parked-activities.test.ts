import { expect, test } from 'bun:test';
import type { DB } from '@vers/db';
import { createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import type { Kysely } from 'kysely';
import { updateParkedActivities } from './update-parked-activities';

async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it reactivates a parked activity whose stamped sim version is now active', async () => {
  await using ctx = await setupTest();

  const activeVersion = await createSimVersionRow(ctx.db, { status: 'active' });
  const user = await createTestUser(ctx.db);

  const avatar = await ctx.db
    .insertInto('avatars')
    .values({ id: 'avatar_reactivated', name: 'avatar-reactivated', userId: user.user.id })
    .returningAll()
    .executeTakeFirstOrThrow();

  const activity = await ctx.db
    .insertInto('activities')
    .values({
      avatarId: avatar.id,
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '0.0.0-dev',
      encounterNode: { difficulty: 1 },
      id: 'act_reactivated',
      lastHash: 'hash_last',
      scopeId: 'node_1',
      scopeType: 'world_map_node',
      secretRef: 'worldmap',
      secretVersion: 1,
      seed: 'seed_1',
      simVersion: activeVersion.engineHash,
      startHash: 'hash_start',
      status: 'parked',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const reactivated = await updateParkedActivities(ctx.db);

  expect(reactivated).toStrictEqual([{ id: activity.id }]);

  const row = await ctx.db
    .selectFrom('activities')
    .select(['parkedFrom', 'status'])
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row).toStrictEqual({ parkedFrom: null, status: 'active' });
});

test('it returns a parked activity to the status it parked from', async () => {
  await using ctx = await setupTest();

  const activeVersion = await createSimVersionRow(ctx.db, { status: 'active' });
  const user = await createTestUser(ctx.db);

  const avatar = await ctx.db
    .insertInto('avatars')
    .values({ id: 'avatar_restored', name: 'avatar-restored', userId: user.user.id })
    .returningAll()
    .executeTakeFirstOrThrow();

  const activity = await ctx.db
    .insertInto('activities')
    .values({
      avatarId: avatar.id,
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '0.0.0-dev',
      encounterNode: { difficulty: 1 },
      id: 'act_restored',
      lastHash: 'hash_last',
      parkedFrom: 'stopped',
      scopeId: 'node_1',
      scopeType: 'world_map_node',
      secretRef: 'worldmap',
      secretVersion: 1,
      seed: 'seed_1',
      simVersion: activeVersion.engineHash,
      startHash: 'hash_start',
      status: 'parked',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const reactivated = await updateParkedActivities(ctx.db);

  expect(reactivated).toStrictEqual([{ id: activity.id }]);

  const row = await ctx.db
    .selectFrom('activities')
    .select(['parkedFrom', 'status'])
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row).toStrictEqual({ parkedFrom: null, status: 'stopped' });
});

test('it leaves a parked activity untouched when no sim version is active for its hash', async () => {
  await using ctx = await setupTest();

  const prunedVersion = await createSimVersionRow(ctx.db, { status: 'pruned' });
  const user = await createTestUser(ctx.db);

  const avatar = await ctx.db
    .insertInto('avatars')
    .values({ id: 'avatar_orphaned', name: 'avatar-orphaned', userId: user.user.id })
    .returningAll()
    .executeTakeFirstOrThrow();

  const activity = await ctx.db
    .insertInto('activities')
    .values({
      avatarId: avatar.id,
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '0.0.0-dev',
      encounterNode: { difficulty: 1 },
      id: 'act_orphaned',
      lastHash: 'hash_last',
      scopeId: 'node_1',
      scopeType: 'world_map_node',
      secretRef: 'worldmap',
      secretVersion: 1,
      seed: 'seed_1',
      simVersion: prunedVersion.engineHash,
      startHash: 'hash_start',
      status: 'parked',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const reactivated = await updateParkedActivities(ctx.db);

  expect(reactivated).toBeEmpty();

  const row = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row.status).toBe('parked');
});

test('it never touches an already-active activity, even when its sim version is active', async () => {
  await using ctx = await setupTest();

  const activeVersion = await createSimVersionRow(ctx.db, { status: 'active' });
  const user = await createTestUser(ctx.db);

  const avatar = await ctx.db
    .insertInto('avatars')
    .values({ id: 'avatar_active', name: 'avatar-active', userId: user.user.id })
    .returningAll()
    .executeTakeFirstOrThrow();

  await ctx.db
    .insertInto('activities')
    .values({
      avatarId: avatar.id,
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '0.0.0-dev',
      encounterNode: { difficulty: 1 },
      id: 'act_already_active',
      lastHash: 'hash_last',
      scopeId: 'node_1',
      scopeType: 'world_map_node',
      secretRef: 'worldmap',
      secretVersion: 1,
      seed: 'seed_1',
      simVersion: activeVersion.engineHash,
      startHash: 'hash_start',
      status: 'active',
    })
    .execute();

  const reactivated = await updateParkedActivities(ctx.db);

  expect(reactivated).toBeEmpty();
});
