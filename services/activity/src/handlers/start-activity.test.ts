import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import { CURRENT_CONTENT_VERSION } from '@vers/game-utils';
import { buildMockScopeSecret, mockKeysService } from '@vers/mock-services/keys';
import {
  createActiveAvatarRow,
  createAnonymousViewer,
  createAvatarRow,
  createServiceToken,
  createTestDB,
  createTestUser,
  createViewer,
  getTestServiceKeyPair,
} from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildRPCTestClient, waitFor } from '@vers/test-utils';
import { deriveWorldmapContent } from '@vers/worldmap-content';
import { findCellCoord, getDifficulty } from '@vers/worldmap-core';
import { sql } from 'kysely';
import invariant from 'tiny-invariant';
import { createActivityService } from '../create-activity-service';
import { server } from '../mocks/server';
import { createMockCheckpointBatch } from '../test-utils/factories/create-mock-checkpoint-batch';

/**
 * `startActivity` opens its own `db.transaction()` to root the new activity under the chain-row
 * lock, which can't nest under the default rollback-on-dispose isolation — this suite runs
 * against a real, committed schema clone instead.
 */
async function setupTest(config: { readonly contentVersion?: string } = {}) {
  const db = await createTestDB({ isolation: 'schema' });

  const service = await createActivityService({
    ...(config.contentVersion !== undefined && { contentVersion: config.contentVersion }),
    db: db.db,
  });

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
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(activity).toStrictEqual({
    appendedAt: null,
    appendedHead: 0,
    avatarID: avatar.id,
    buildSnapshot: { level: 1, xp: 42 },
    contentVersion: CURRENT_CONTENT_VERSION,
    createdAt: expect.toBeValidDate(),
    encounterNode: { difficulty: 0, poolID: expect.toBeString() },
    id: expect.toBeString(),
    keyVersion: 1,
    lastHash: expect.toBeString(),
    scopeID: '0_0',
    scopeType: 'world_map_node',
    secretRef: 'worldmap',
    secretVersion: 1,
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
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  expect(activity.encounterNode).toStrictEqual({ difficulty: 1, poolID: expect.toBeString() });

  const row = await ctx.db
    .selectFrom('activities')
    .select('encounterNode')
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row.encounterNode).toStrictEqual({ difficulty: 1, poolID: expect.toBeString() });
});

test('it derives a startHash that folds in the resolved encounter node', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  expect(activity.startHash).toBe(
    buildStartHash({
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
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const chain = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
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
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'stopped' })
    .where('id', '=', first.id)
    .execute();

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '1_0',
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
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'stopped' })
    .where('id', '=', first.id)
    .execute();

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
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
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: '1_0', scopeType: 'world_map_node' }),
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
    client.startActivity({ avatarID: avatar.id, scopeID: '0_0', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({ avatarID: 'avatar_1', scopeID: '0_0', scopeType: 'world_map_node' }),
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
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'quarantined' })
    .where('id', '=', started.id)
    .execute();

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: '0_0', scopeType: 'world_map_node' }),
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
    scopeID: '0_0',
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
    scopeID: '0_0',
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
    client.startActivity({ avatarID: avatar.id, scopeID: '0_0', scopeType: 'world_map_node' }),
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
    scopeID: '0_0',
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
      scopeID: '0_0',
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
      scopeID: '0_0',
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
      scopeID: '0_0',
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
    scopeID: '0_0',
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
      .where('scopeId', '=', '0_0')
      .execute();

    const start = client.startActivity({
      avatarID: avatar.id,
      scopeID: '0_0',
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
    scopeID: '0_0',
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
    scopeID: '0_0',
    scopeType: 'world_map_node',
    startKey: 'start_request_1',
  });

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
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
    scopeID: '0_0',
    scopeType: 'world_map_node',
    startKey: 'start_request_1',
  });

  expect(
    client.startActivity({
      avatarID: avatar.id,
      scopeID: '0_0',
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
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: '0_0', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({ code: 'CONFLICT', data: { activity: { id: first.id } } });
});

test('it conflicts a keyed duplicate once the row has appended progress', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    startKey: 'start_request_1',
  });

  // a duplicate delivered after progress landed must conflict — returning the row would hand the
  // caller a zero cursor onto a progressed chain
  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: 1 })
    .where('id', '=', first.id)
    .execute();

  expect(
    client.startActivity({
      avatarID: avatar.id,
      scopeID: '0_0',
      scopeType: 'world_map_node',
      startKey: 'start_request_1',
    }),
  ).rejects.toMatchObject({ code: 'CONFLICT', data: { activity: { id: first.id } } });
});

test('it conflicts a keyed duplicate arriving from a different session', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({
    audience: 'service-activity',
    db: ctx.db,
    sessionID: 'session_writer',
  });

  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const writerClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await writerClient.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    startKey: 'start_request_1',
  });

  const keyPair = await getTestServiceKeyPair();

  const otherSessionToken = await createServiceToken({
    actingSessionId: 'session_other',
    actingUserId: viewer.user.id,
    audience: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const otherClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: otherSessionToken });

  expect(
    otherClient.startActivity({
      avatarID: avatar.id,
      scopeID: '0_0',
      scopeType: 'world_map_node',
      startKey: 'start_request_1',
    }),
  ).rejects.toMatchObject({ code: 'CONFLICT', data: { activity: { id: first.id } } });
});

test('it conflicts a keyed duplicate naming a different scope', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    startKey: 'start_request_1',
  });

  expect(
    client.startActivity({
      avatarID: avatar.id,
      scopeID: '1_0',
      scopeType: 'world_map_node',
      startKey: 'start_request_1',
    }),
  ).rejects.toMatchObject({ code: 'CONFLICT', data: { activity: { id: first.id } } });
});

test("it includes a stopped-but-unverified terminal activity's xp in a new build snapshot", async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { level: 1, userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 150 }, type: 'completed' },
    startPrevHash: first.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({ activityID: first.id, checkpoints: batch, expectedHead: 0 });

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(second.buildSnapshot).toStrictEqual({ level: 2, xp: 150 });
});

test("it excludes a rejected activity's xp from a new build snapshot", async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { level: 1, userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 150 }, type: 'completed' },
    startPrevHash: first.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({ activityID: first.id, checkpoints: batch, expectedHead: 0 });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'rejected' })
    .where('id', '=', first.id)
    .execute();

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(second.buildSnapshot).toStrictEqual({ level: 1, xp: 0 });
});

test("it excludes a parked activity's xp from a new build snapshot", async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { level: 1, userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 150 }, type: 'completed' },
    startPrevHash: first.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({ activityID: first.id, checkpoints: batch, expectedHead: 0 });

  await ctx.db
    .updateTable('activities')
    .set({ parkedFrom: 'stopped', status: 'parked' })
    .where('id', '=', first.id)
    .execute();

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(second.buildSnapshot).toStrictEqual({ level: 1, xp: 0 });
});

test("it includes a stopped run's unsettled progress xp in a new build snapshot", async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { level: 1, userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    count: 2,
    finalPayloadOverrides: { rewards: { xp: 60 }, type: 'progress' },
    startPrevHash: first.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({ activityID: first.id, checkpoints: batch, expectedHead: 0 });
  await client.stopActivity({ avatarID: avatar.id });

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(second.buildSnapshot).toStrictEqual({ level: 1, xp: 60 });
});

test('it stamps the build snapshot from settled xp/level alone when the avatar carries no pending work', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    level: 3,
    userId: viewer.user.id,
    xp: 500,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(activity.buildSnapshot).toStrictEqual({ level: 3, xp: 500 });
});

test('it records the unverified run a new build snapshot borrowed its xp from', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { level: 1, userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 150 }, type: 'completed' },
    startPrevHash: first.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({ activityID: first.id, checkpoints: batch, expectedHead: 0 });

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  const sources = await ctx.db
    .selectFrom('activitySnapshotSources')
    .select('sourceActivityId')
    .where('activityId', '=', second.id)
    .execute();

  expect(sources).toStrictEqual([{ sourceActivityId: first.id }]);
});

test('it records no borrowed run for an unsettled run that moved the total by nothing', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { level: 1, userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 0 }, type: 'completed' },
    startPrevHash: first.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({ activityID: first.id, checkpoints: batch, expectedHead: 0 });

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  const sources = await ctx.db
    .selectFrom('activitySnapshotSources')
    .select('sourceActivityId')
    .where('activityId', '=', second.id)
    .execute();

  expect(sources).toBeEmpty();
  expect(second.buildSnapshot).toStrictEqual({ level: 1, xp: 0 });
});

test('it records a borrowed run whose death penalty lowered the total', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { level: 2, userId: viewer.user.id, xp: 200 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: -50 }, type: 'failed' },
    startPrevHash: first.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({ activityID: first.id, checkpoints: batch, expectedHead: 0 });

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  const sources = await ctx.db
    .selectFrom('activitySnapshotSources')
    .select('sourceActivityId')
    .where('activityId', '=', second.id)
    .execute();

  expect(sources).toStrictEqual([{ sourceActivityId: first.id }]);
  expect(second.buildSnapshot).toStrictEqual({ level: 2, xp: 150 });
});

test('it records no borrowed run when the avatar carries no pending work', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { level: 3, userId: viewer.user.id, xp: 500 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const sources = await ctx.db
    .selectFrom('activitySnapshotSources')
    .select('sourceActivityId')
    .where('activityId', '=', activity.id)
    .execute();

  expect(sources).toBeEmpty();
});

test('it records no borrowed run for a parked activity left out of the build snapshot', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { level: 1, userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 150 }, type: 'completed' },
    startPrevHash: first.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({ activityID: first.id, checkpoints: batch, expectedHead: 0 });

  await ctx.db
    .updateTable('activities')
    .set({ parkedFrom: 'stopped', status: 'parked' })
    .where('id', '=', first.id)
    .execute();

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  const sources = await ctx.db
    .selectFrom('activitySnapshotSources')
    .select('sourceActivityId')
    .where('activityId', '=', second.id)
    .execute();

  expect(sources).toBeEmpty();
});

test("it starts an activity when the starting avatar is the account's active one", async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActiveAvatarRow(ctx.db, { avatarId: avatar.id, userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(activity.avatarID).toBe(avatar.id);
});

test('it rejects a start from an avatar that is not the active one, naming the active avatar', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const activeAvatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });
  const otherAvatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActiveAvatarRow(ctx.db, { avatarId: activeAvatar.id, userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({
      avatarID: otherAvatar.id,
      scopeID: '0_0',
      scopeType: 'world_map_node',
    }),
  ).rejects.toMatchObject({
    code: 'AVATAR_NOT_ACTIVE',
    data: { activeAvatarID: activeAvatar.id, activeAvatarName: activeAvatar.name },
  });
});

test('it makes the starting avatar active when the account holds no selection', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const selection = await ctx.db
    .selectFrom('activeAvatars')
    .selectAll()
    .where('userId', '=', viewer.user.id)
    .executeTakeFirstOrThrow();

  expect(selection.avatarId).toBe(avatar.id);
});

test('it refuses to adopt while another avatar holds a live run', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const liveAvatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });
  const otherAvatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  // no active_avatars row exists yet; this start's own adopt claims the slot for liveAvatar
  await client.startActivity({
    avatarID: liveAvatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await ctx.db.deleteFrom('activeAvatars').where('userId', '=', viewer.user.id).execute();

  const conflictingStart = client.startActivity({
    avatarID: otherAvatar.id,
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  // `.rejects` chains type as synchronous and are ordinarily left unawaited, but the trailing
  // query below must observe the rejected call's transaction fully settled — draining it here
  // guarantees that ordering before the shape assertion below runs against the settled promise.
  await conflictingStart.catch(() => {});

  expect(conflictingStart).rejects.toMatchObject({
    code: 'AVATAR_NOT_ACTIVE',
    data: { activeAvatarID: liveAvatar.id, activeAvatarName: liveAvatar.name },
  });

  const minted = await ctx.db
    .selectFrom('activities')
    .selectAll()
    .where('avatarId', '=', otherAvatar.id)
    .executeTakeFirst();

  expect(minted).toBeUndefined();

  const selection = await ctx.db
    .selectFrom('activeAvatars')
    .selectAll()
    .where('userId', '=', viewer.user.id)
    .executeTakeFirst();

  expect(selection).toBeUndefined();
});

test('it stamps secretRef and secretVersion on the minted row', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(activity.secretRef).toBe('worldmap');
  expect(activity.secretVersion).toBe(1);
});

test('it stamps a poolID matching the sealed derivation truth for content version 2, and folds it into the startHash', async () => {
  await using ctx = await setupTest({ contentVersion: '2' });

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  const coord = findCellCoord('1_0');

  invariant(coord, 'scope id 1_0 must resolve to a valid cell coordinate');

  const scopeSecret = buildMockScopeSecret(avatar.id, 'worldmap', 1);
  const expected = deriveWorldmapContent('2', { coord, scopeSecret, userSeed: 0 });

  expect(activity.encounterNode).toStrictEqual({
    difficulty: getDifficulty(coord[0], coord[1]),
    poolID: expected.poolID,
  });

  expect(activity.startHash).toBe(
    buildStartHash({
      contentVersion: '2',
      encounterNode: activity.encounterNode,
      keyVersion: activity.keyVersion,
      seed: activity.seed,
      simVersion: activity.simVersion,
    }),
  );
});

test('it fails a start with a 500 when the keys dispatch fails', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  server.use(
    mockKeysService.deriveScopeSecret.handler(() => {
      throw new Error('keys backend unreachable');
    }),
  );

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: '0_0', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
});
