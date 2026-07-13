import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import type { Isolation } from '@vers/service-test-utils/bun';
import {
  createAnonymousViewer,
  createTestDB,
  createTestUser,
  createViewer,
} from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';

async function setupTest(options: { readonly isolation?: Isolation } = {}) {
  const db = await createTestDB(options);
  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it starts an activity for an avatar owned by the acting user', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    level: 5,
    userId: viewer.user.id,
    xp: 42,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  expect(activity).toStrictEqual({
    appendedAt: null,
    appendedHead: 0,
    avatarID: avatar.id,
    buildSnapshot: { level: 5, xp: 42 },
    contentVersion: '0.0.0-dev',
    createdAt: expect.toBeValidDate(),
    id: expect.toBeString(),
    lastHash: expect.toBeString(),
    scopeID: 'node_1',
    scopeType: 'world_map_node',
    seed: expect.toBeString(),
    simVersion: '0.0.0-dev',
    startChainIndex: 0,
    startHash: expect.toBeString(),
    startedAt: expect.toBeValidDate(),
    status: 'active',
    stoppedAt: null,
    updatedAt: expect.toBeValidDate(),
    verifiedAt: null,
    verifiedHead: 0,
  });

  expect(activity.lastHash).toBe(activity.startHash);
});

test('it mints a chain row on a node visited for the first time, with the activity seeded from its genesis', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  const chain = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', 'node_1')
    .executeTakeFirstOrThrow();

  expect(activity.seed).toBe(chain.genesisSeed);
  expect(activity.seed).toBe(chain.appendedNextSeed);
  expect(activity.startChainIndex).toBe(0);
  expect(chain.appendedChainIndex).toBe(0);
});

test('it mints independent genesis seeds for different nodes visited by the same avatar', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'stopped' })
    .where('id', '=', first.id)
    .execute();

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_2',
    scopeType: 'world_map_node',
  });

  expect(second.seed).not.toBe(first.seed);
});

// a re-touch of an already-chained node reads the same appended anchor rather than minting a
// fresh seed.
test('it reads the existing chain anchor for a second activity on an already-chained node', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'stopped' })
    .where('id', '=', first.id)
    .execute();

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  expect(second.seed).toBe(first.seed);
  expect(second.startChainIndex).toBe(first.startChainIndex);
  expect(second.startChainIndex).toBe(0);
});

// schema isolation: the handler re-queries for the conflicting activity after catching the
// unique violation, and a prior statement's constraint violation aborts the rest of a shared
// test transaction under the default isolation.
test('it rejects a second start with CONFLICT carrying the already-active activity', async () => {
  await using ctx = await setupTest({ isolation: 'schema' });

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: 'node_2', scopeType: 'world_map_node' }),
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
    client.startActivity({ avatarID: avatar.id, scopeID: 'node_1', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.startActivity({ avatarID: 'avatar_1', scopeID: 'node_1', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

test('it blocks a new start while the chain is quarantined', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'quarantined' })
    .where('id', '=', started.id)
    .execute();

  expect(
    client.startActivity({ avatarID: avatar.id, scopeID: 'node_1', scopeType: 'world_map_node' }),
  ).rejects.toMatchObject({ code: 'CHAIN_QUARANTINED' });
});

test('it stamps the acting session as the new activity writer', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({
    audience: 'service-activity',
    db: ctx.db,
    sessionID: 'session-a',
  });

  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  const row = await ctx.db
    .selectFrom('activities')
    .select('writerSessionId')
    .where('id', '=', started.id)
    .executeTakeFirstOrThrow();

  expect(row.writerSessionId).toBe('session-a');
});
