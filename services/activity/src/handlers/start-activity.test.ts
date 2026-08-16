import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { createContentVersion } from '@vers/content-registry';
import type { ActivityContract } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { buildMockScopeSecret, mockKeysService } from '@vers/mock-services/keys';
import {
  createActiveAvatarRow,
  createActivityChainRow,
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
import { collectNodeEdges, findCellCoord, getDifficulty } from '@vers/worldmap-core';
import { sql } from 'kysely';
import invariant from 'tiny-invariant';
import { createActivityService } from '../create-activity-service';
import { server } from '../mocks/server';
import { createMockActivity } from '../test-utils/factories/create-mock-activity';
import { createMockCheckpointBatch } from '../test-utils/factories/create-mock-checkpoint-batch';

/**
 * `startActivity` opens its own `db.transaction()` to root the new activity under the chain-row
 * lock, which can't nest under the default rollback-on-dispose isolation — this suite runs
 * against a real, committed schema clone instead. Content is seeded here, once, since every test
 * needs a current version to start against and none of them vary its shape; the sim version is
 * left to each test, since the registry's presence, absence, or pruned state is what several of
 * them are specifically about.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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
    contentVersion: '2',
    createdAt: expect.toBeValidDate(),
    encounterNode: { difficulty: 0, poolID: expect.toBeString() },
    id: expect.toBeString(),
    keyVersion: 1,
    lastHash: expect.toBeString(),
    playedAt: null,
    predecessorActivityID: null,
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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '1_0' });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: '1_0', kind: 'first_clear' })
    .execute();

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '1_0' });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: '1_0', kind: 'first_clear' })
    .execute();

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: 'not_a_real_node' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({
      avatarID: avatar.id,
      scopeID: 'not_a_real_node',
      scopeType: 'world_map_node',
    }),
  ).rejects.toMatchObject({ code: 'NODE_UNKNOWN' });
});

test('it starts an activity at the origin for an avatar with no grants at all', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(activity.scopeID).toBe('0_0');
});

test('it rejects starting at a node outside the origin, completed set, and their neighbours with NODE_UNREACHABLE', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '50_50' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: '50_50', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({ code: 'NODE_UNREACHABLE' });
});

test('it starts an activity on a node the avatar already holds a first-clear grant for', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '50_50' });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: '50_50', kind: 'first_clear' })
    .execute();

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '50_50',
    scopeType: 'world_map_node',
  });

  expect(activity.scopeID).toBe('50_50');
});

test('it starts an activity on a neighbour of a node the avatar holds a first-clear grant for', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const grantedID = '50_50';
  const grantedCoord = findCellCoord(grantedID);

  invariant(grantedCoord, 'grantedID must resolve to a valid cell coordinate');

  const [edge] = collectNodeEdges(avatar.seed, grantedCoord[0], grantedCoord[1]);

  invariant(edge, 'every cell connects to at least one neighbour');

  const [aID = '', bID = ''] = edge.id.split('|');
  const neighbourID = aID === grantedID ? bID : aID;

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: neighbourID });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: grantedID, kind: 'first_clear' })
    .execute();

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: neighbourID,
    scopeType: 'world_map_node',
  });

  expect(activity.scopeID).toBe(neighbourID);
});

test('it roots the first activity on a revealed node at the chain row genesis', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

test('it rejects starting on a node with no revealed chain with NODE_NOT_REVEALED', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: '0_0', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({ code: 'NODE_NOT_REVEALED' });
});

test('it roots activities at independent genesis seeds for different revealed nodes', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });
  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '1_0' });

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

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: '1_0', kind: 'first_clear' })
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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });
  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '1_0' });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: '1_0', kind: 'first_clear' })
    .execute();

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

test('it rejects a client-requested version whose engine predates the current content with SIM_VERSION_EXPIRED', async () => {
  await using ctx = await setupTest();

  const stamped = await createSimVersionRow(ctx.db, {
    maxContentVersion: '1',
    retainedUntil: new Date('2099-01-01'),
    status: 'active',
  });

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({
      avatarID: avatar.id,
      scopeID: '0_0',
      scopeType: 'world_map_node',
      simVersion: stamped.engineHash,
    }),
  ).rejects.toMatchObject({
    code: 'SIM_VERSION_EXPIRED',
    data: { currentSimVersion: stamped.engineHash },
  });
});

test('it rejects a hash-less start with SIM_VERSION_EXPIRED when the registry-current engine predates the current content', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db, { maxContentVersion: '1' });
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: '0_0', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({
    code: 'SIM_VERSION_EXPIRED',
    data: { currentSimVersion: current.engineHash },
  });
});

test('it stamps a new activity when the resolved engine supports the current content exactly', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db, { maxContentVersion: '2' });
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(activity.simVersion).toBe(current.engineHash);
});

test('it roots a new activity at the anchor a concurrent forward exit commits', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });
  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '1_0' });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: '1_0', kind: 'first_clear' })
    .execute();

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(activity.buildSnapshot).toStrictEqual({ level: 3, xp: 500 });
});

test("it starts an activity when the starting avatar is the account's active one", async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });
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

  await createActivityChainRow(ctx.db, { avatarId: otherAvatar.id, scopeId: '0_0' });
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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  await createActivityChainRow(ctx.db, { avatarId: liveAvatar.id, scopeId: '0_0' });

  const otherAvatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: otherAvatar.id, scopeId: '1_0' });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: otherAvatar.id, key: '1_0', kind: 'first_clear' })
    .execute();

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(activity.secretRef).toBe('worldmap');
  expect(activity.secretVersion).toBe(1);
});

test('it stamps a poolID matching the sealed derivation truth for the current content, and folds it into the startHash', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '1_0' });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: '1_0', kind: 'first_clear' })
    .execute();

  // publish this test's own document, moving the current pointer onto it, so the derivation truth
  // asserted below comes from content this test authored rather than the suite's shared seed; the
  // seeded engine declares it bundled, or the compatibility gate would refuse the start
  const document = createMockContentDocument();

  await createSimVersionRow(ctx.db, { maxContentVersion: document.contentVersion });
  await createContentVersion(ctx.db, document);

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  const coord = findCellCoord('1_0');

  invariant(coord, 'scope id 1_0 must resolve to a valid cell coordinate');

  const scopeSecret = buildMockScopeSecret(avatar.id, 'worldmap', 1);

  const expected = deriveWorldmapContent(document.encounter, {
    coord,
    scopeSecret,
    userSeed: avatar.seed,
  });

  expect(activity.encounterNode).toStrictEqual({
    difficulty: getDifficulty(coord[0], coord[1]),
    poolID: expected.poolID,
  });

  expect(activity.startHash).toBe(
    buildStartHash({
      contentVersion: document.contentVersion,
      encounterNode: activity.encounterNode,
      keyVersion: activity.keyVersion,
      seed: activity.seed,
      simVersion: activity.simVersion,
    }),
  );
});

test("it seals the stamped poolID under the avatar's own seed, not a shared placeholder", async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  // a fixed id and seed, verified against this test's two-pool content to pick a different pool
  // than userSeed 0 would — a start that reverted to a pinned zero seed would stamp the other pool
  // and fail the assertion below, rather than passing by coincidence
  const avatar = await createAvatarRow(ctx.db, {
    id: 'avatar_seed_divergent_pool',
    seed: 700,
    userId: viewer.user.id,
  });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '1_0' });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: '1_0', kind: 'first_clear' })
    .execute();

  const contentVersion = '849849';

  const document = createMockContentDocument({
    contentVersion,
    encounter: {
      contentVersion,
      archetypes: [
        {
          id: 'placeholder-brawler',
          name: 'World Map Enemy',
          baseLevel: 1,
          baseLife: 30,
          baseXP: 10,
          attackMin: 1,
          attackMax: 3,
          attackSpeed: 0.5,
        },
        {
          id: 'placeholder-skirmisher',
          name: 'World Map Skirmisher',
          baseLevel: 1,
          baseLife: 20,
          baseXP: 8,
          attackMin: 1,
          attackMax: 4,
          attackSpeed: 0.7,
        },
      ],
      pools: [
        { id: 'brawler-den', entries: [{ archetypeID: 'placeholder-brawler', weight: 1 }] },
        { id: 'skirmisher-flock', entries: [{ archetypeID: 'placeholder-skirmisher', weight: 1 }] },
      ],
      tuning: {
        waveCountMin: 3,
        waveCountMax: 6,
        waveSizeMin: 3,
        waveSizeMax: 6,
        difficultyScalingFactor: 1,
      },
    },
  });

  await createSimVersionRow(ctx.db, { maxContentVersion: document.contentVersion });
  await createContentVersion(ctx.db, document);

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  const coord = findCellCoord('1_0');

  invariant(coord, 'scope id 1_0 must resolve to a valid cell coordinate');

  const scopeSecret = buildMockScopeSecret(avatar.id, 'worldmap', 1);

  const sealedUnderZero = deriveWorldmapContent(document.encounter, {
    coord,
    scopeSecret,
    userSeed: 0,
  });

  const sealedUnderAvatarSeed = deriveWorldmapContent(document.encounter, {
    coord,
    scopeSecret,
    userSeed: avatar.seed,
  });

  expect(sealedUnderAvatarSeed.poolID).not.toBe(sealedUnderZero.poolID);

  expect(activity.encounterNode).toStrictEqual({
    difficulty: getDifficulty(coord[0], coord[1]),
    poolID: sealedUnderAvatarSeed.poolID,
  });
});

test('it fails a start with a 500 when the keys dispatch fails', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

test('it bails with PREDECESSOR_PENDING on a start naming a predecessor not yet on the server, then succeeds once the predecessor lands', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });
  const predecessorID = `act_${createId()}`;

  const pendingStart = client.startActivity({
    avatarID: avatar.id,
    predecessorActivityID: predecessorID,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  // drain the rejection so its transaction settles before the read-back below observes it
  await pendingStart.catch(() => {});

  expect(pendingStart).rejects.toMatchObject({ code: 'PREDECESSOR_PENDING' });

  // the FK-violating insert rolled back entirely — no half-minted row is left behind
  const rowsBeforePredecessor = await ctx.db
    .selectFrom('activities')
    .select('id')
    .where('avatarId', '=', avatar.id)
    .execute();

  expect(rowsBeforePredecessor).toHaveLength(0);

  // the predecessor reaches the server, exactly as it would from the same device's own outbox
  // delivery
  await ctx.db
    .insertInto('activities')
    .values(
      createMockActivity({
        avatarId: avatar.id,
        id: predecessorID,
        scopeId: '0_0',
        scopeType: 'world_map_node',
        status: 'stopped',
      }),
    )
    .execute();

  const started = await client.startActivity({
    avatarID: avatar.id,
    predecessorActivityID: predecessorID,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(started.predecessorActivityID).toBe(predecessorID);
});
