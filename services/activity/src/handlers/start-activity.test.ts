import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import { CURRENT_CONTENT_VERSION } from '@vers/game-utils';
import {
  createAnonymousViewer,
  createTestDB,
  createTestUser,
  createViewer,
} from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildRPCTestClient, waitFor } from '@vers/test-utils';
import { sql } from 'kysely';
import { createActivityService } from '../create-activity-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';

/**
 * `startActivity` opens its own `db.transaction()` to root the new activity under the chain-row
 * lock, which can't nest under the default rollback-on-dispose isolation — this suite runs
 * against a real, committed schema clone instead.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });
  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it starts an activity for an avatar owned by the acting user', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    level: 5,
    userId: viewer.user.id,
    xp: 42,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  expect(activity).toStrictEqual({
    appendedAt: null,
    appendedHead: 0,
    avatarID: avatar.id,
    buildSnapshot: { level: 5, xp: 42 },
    contentVersion: CURRENT_CONTENT_VERSION,
    createdAt: expect.toBeValidDate(),
    encounterNode: { difficulty: 0 },
    id: expect.toBeString(),
    keyVersion: 1,
    lastHash: expect.toBeString(),
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    seed: expect.toBeString(),
    simVersion: current.engineHash,
    startChainIndex: 0,
    startHash: expect.toBeString(),
    startKey: null,
    startedAt: expect.toBeValidDate(),
    status: 'active',
    stoppedAt: null,
    updatedAt: expect.toBeValidDate(),
    verifiedAt: null,
    verifiedHead: 0,
  });

  expect(activity.lastHash).toBe(activity.startHash);
});

test("it stamps the row's encounterNode from the static world map's node for the given scope id", async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'esaxrt',
    scopeType: 'world_map_node',
  });

  expect(activity.encounterNode).toStrictEqual({ difficulty: 1 });

  const row = await ctx.db
    .selectFrom('activities')
    .select('encounterNode')
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row.encounterNode).toStrictEqual({ difficulty: 1 });
});

test('it derives a startHash that folds in the resolved encounter node', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'esaxrt',
    scopeType: 'world_map_node',
  });

  expect(activity.startHash).toBe(
    buildStartHash({
      activityID: activity.id,
      contentVersion: activity.contentVersion,
      encounterNode: activity.encounterNode,
      keyVersion: activity.keyVersion,
      seed: activity.seed,
      simVersion: current.engineHash,
    }),
  );
});

test('it rejects starting an activity on an unregistered scope id with NODE_UNKNOWN', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({
      avatarID: avatar.id,
      scopeID: 'not_a_real_node',
      scopeType: 'world_map_node',
    }),
  ).rejects.toMatchObject({ code: 'NODE_UNKNOWN' });
});

test('it mints a chain row on a node visited for the first time, with the activity seeded from its genesis', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  const chain = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', 'a9lp75')
    .executeTakeFirstOrThrow();

  expect(activity.seed).toBe(chain.genesisSeed);
  expect(activity.seed).toBe(chain.appendedNextSeed);
  expect(activity.startChainIndex).toBe(0);
  expect(chain.appendedChainIndex).toBe(0);
});

test('it mints independent genesis seeds for different nodes visited by the same avatar', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'stopped' })
    .where('id', '=', first.id)
    .execute();

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'esaxrt',
    scopeType: 'world_map_node',
  });

  expect(second.seed).not.toBe(first.seed);
});

// a re-touch of an already-chained node reads the same appended anchor rather than minting a
// fresh seed.
test('it reads the existing chain anchor for a second activity on an already-chained node', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'stopped' })
    .where('id', '=', first.id)
    .execute();

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  expect(second.seed).toBe(first.seed);
  expect(second.startChainIndex).toBe(first.startChainIndex);
  expect(second.startChainIndex).toBe(0);
});

test('it rejects a second start with CONFLICT carrying the already-active activity', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: 'esaxrt', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({
    code: 'CONFLICT',
    data: { activity: { id: first.id } },
  });
});

test('it rejects starting an activity on a foreign avatar with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const owner = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: owner.user.id });
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: 'a9lp75', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({ avatarID: 'avatar_1', scopeID: 'a9lp75', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

test('it blocks a new start while the chain is quarantined', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'quarantined' })
    .where('id', '=', started.id)
    .execute();

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: 'a9lp75', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({ code: 'CHAIN_QUARANTINED' });
});

test('it stamps the acting session as the new activity writer', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({
    audience: 'service-activity',
    db: ctx.db,
    sessionID: 'session-a',
  });

  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  const row = await ctx.db
    .selectFrom('activities')
    .select('writerSessionId')
    .where('id', '=', started.id)
    .executeTakeFirstOrThrow();

  expect(row.writerSessionId).toBe('session-a');
});

test('it stamps a new activity with the registry current version when the client sends no hash', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, { retainedUntil: new Date('2020-01-01'), status: 'pruned' });

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  expect(activity.simVersion).toBe(current.engineHash);
});

test('it rejects a start with SIM_VERSION_UNKNOWN carrying a null current version when the registry is empty', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: 'a9lp75', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({
    code: 'SIM_VERSION_UNKNOWN',
    data: { currentSimVersion: null },
  });
});

test('it echoes the client-stamped sim version when its row is active and retained', async () => {
  await using ctx = await setupTest();

  const stamped = await createSimVersionRow(ctx.db, {
    retainedUntil: new Date('2099-01-01'),
    status: 'active',
  });

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    simVersion: stamped.engineHash,
  });

  expect(activity.simVersion).toBe(stamped.engineHash);
});

test('it rejects an unrecognized stamped version with SIM_VERSION_UNKNOWN carrying the current hash', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({
      avatarID: avatar.id,
      scopeID: 'a9lp75',
      scopeType: 'world_map_node',
      simVersion: 'hash_never_registered',
    }),
  ).rejects.toMatchObject({
    code: 'SIM_VERSION_UNKNOWN',
    data: { currentSimVersion: current.engineHash },
  });
});

test('it rejects a pruned stamped version with SIM_VERSION_EXPIRED', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);

  const pruned = await createSimVersionRow(ctx.db, {
    retainedUntil: new Date('2099-01-01'),
    status: 'pruned',
  });

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({
      avatarID: avatar.id,
      scopeID: 'a9lp75',
      scopeType: 'world_map_node',
      simVersion: pruned.engineHash,
    }),
  ).rejects.toMatchObject({
    code: 'SIM_VERSION_EXPIRED',
    data: { currentSimVersion: current.engineHash },
  });
});

test('it rejects an active stamped version past its retention deadline with SIM_VERSION_EXPIRED', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db, { deployedAt: new Date('2026-02-01') });

  const stale = await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-01-01'),
    retainedUntil: new Date('2020-01-01'),
    status: 'active',
  });

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({
      avatarID: avatar.id,
      scopeID: 'a9lp75',
      scopeType: 'world_map_node',
      simVersion: stale.engineHash,
    }),
  ).rejects.toMatchObject({
    code: 'SIM_VERSION_EXPIRED',
    data: { currentSimVersion: current.engineHash },
  });
});

test('it roots a new activity at the anchor a concurrent forward exit commits', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  await client.stopActivity({ avatarID: avatar.id });

  expect(first.status).toBeDefined();

  const anchorSeed = '0f'.repeat(16);

  // A transaction holding the chain-row lock with an uncommitted anchor advance stands in for a
  // forward exit still in flight. The advance commits only once the concurrent start is observed
  // queued behind the lock, so the blocking interleaving is what actually runs — and a start that
  // roots without ever taking the lock times the wait out and fails the test.
  const held = await ctx.db.transaction().execute(async (trx) => {
    await trx
      .updateTable('activityChains')
      .set({ appendedChainIndex: 7, appendedNextSeed: anchorSeed })
      .where('avatarId', '=', avatar.id)
      .where('scopeType', '=', 'world_map_node')
      .where('scopeId', '=', 'a9lp75')
      .execute();

    const start = client.startActivity({
      avatarID: avatar.id,
      scopeID: 'a9lp75',
      scopeType: 'world_map_node',
    });

    // pg_stat_activity is snapshot-cached for the duration of the polling transaction, so the
    // wait reads pg_locks, which reports the lock manager live.
    await waitFor(
      async () => {
        const blocked = await sql<{ waiting: number }>`
          select count(*)::int as waiting from pg_locks where not granted
        `.execute(trx);

        expect(blocked.rows[0]?.waiting).toBeGreaterThan(0);
      },
      { intervalMs: 10, timeoutMs: 3000 },
    );

    return { pending: start };
  });

  const started = await held.pending;

  expect(started.seed).toBe(anchorSeed);

  const row = await ctx.db
    .selectFrom('activities')
    .select('startChainIndex')
    .where('id', '=', started.id)
    .executeTakeFirstOrThrow();

  expect(row.startChainIndex).toBe(7);
});

test('it stamps the start key on the minted row', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: 'start_request_1',
  });

  expect(started.startKey).toBe('start_request_1');
});

test('it answers a duplicate start carrying the same key with the row already minted', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: 'start_request_1',
  });

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: 'start_request_1',
  });

  expect(second).toStrictEqual(first);
});

test('it conflicts a keyed start when the active row carries a different key', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: 'start_request_1',
  });

  expect(
    client.startActivity({
      avatarID: avatar.id,
      scopeID: 'a9lp75',
      scopeType: 'world_map_node',
      startKey: 'continue_of_something_else',
    }),
  ).rejects.toMatchObject({ code: 'CONFLICT', data: { activity: { id: first.id } } });
});

test('it conflicts an unkeyed duplicate start as before', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: 'a9lp75', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({ code: 'CONFLICT', data: { activity: { id: first.id } } });
});
