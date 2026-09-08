import { expect, test } from 'bun:test';
import type { DB } from '@vers/db';
import { createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { collectRetentionRefusals } from './collect-retention-refusals';
import { createSimVersionRow } from './test-utils/create-sim-version-row';

async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it names each expired version the sweep refuses with its count of unverified activities', async () => {
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
    .values([
      {
        appendedHead: 3,
        avatarId: avatar.id,
        buildSnapshot: { level: 1, xp: 0 },
        contentVersion: '0.0.0-dev',
        encounterNode: { difficulty: 1 },
        id: 'act_pinned_unverified',
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
      },
      {
        appendedHead: 3,
        avatarId: avatar.id,
        buildSnapshot: { level: 1, xp: 0 },
        contentVersion: '0.0.0-dev',
        encounterNode: { difficulty: 1 },
        id: 'act_pinned_verified',
        lastHash: 'hash_last',
        scopeId: 'node_2',
        scopeType: 'world_map_node',
        secretRef: 'worldmap',
        secretVersion: 1,
        seed: 'seed_2',
        simVersion: pinned.engineHash,
        startHash: 'hash_start',
        status: 'stopped',
        verifiedHead: 3,
      },
    ])
    .execute();

  const refusals = await collectRetentionRefusals(ctx.db);

  expect(refusals).toStrictEqual([{ engineHash: pinned.engineHash, unverifiedActivities: 1 }]);
});

test('it reports nothing when every expired version is free of unverified work', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-02-01T00:00:00Z'),
    engineHash: 'hash_current',
    retainedUntil: new Date('2099-01-01T00:00:00Z'),
    status: 'active',
  });

  await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2020-01-01T00:00:00Z'),
    engineHash: 'hash_free',
    retainedUntil: new Date('2020-01-01T00:00:00Z'),
    status: 'active',
  });

  expect(collectRetentionRefusals(ctx.db)).resolves.toBeEmpty();
});
