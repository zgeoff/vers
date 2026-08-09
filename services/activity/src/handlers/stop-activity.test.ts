import { expect, mock, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import type { ActivityContract } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { mockReplayService } from '@vers/mock-services/replay';
import {
  createAnonymousViewer,
  createAvatarRow,
  createServiceToken,
  createTestDB,
  createViewer,
  getTestServiceKeyPair,
} from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildRPCTestClient, waitFor } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';
import { server } from '../mocks/server';
import { createMockCheckpointBatch } from '../test-utils/factories/create-mock-checkpoint-batch';

/**
 * `stopActivity` opens its own `db.transaction()` for the terminal-status claim and the chain's
 * consequent anchor advance, which can't nest under the default rollback-on-dispose isolation —
 * this suite runs against a real, committed schema clone instead.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);
  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

  const service = await createActivityService({ db: db.db, wakeCoalesceWindowMs: 0 });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it stops the active activity for an avatar owned by the acting user', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const stopped = await client.stopActivity({ avatarID: avatar.id });

  expect(stopped).toStrictEqual({
    ...started,
    status: 'stopped',
    stoppedAt: expect.toBeValidDate(),
    updatedAt: expect.toBeValidDate(),
  });
});

test('it rejects stopping when nothing is active for that avatar with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.stopActivity({ avatarID: avatar.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.stopActivity({ avatarID: 'avatar_1' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

test('it advances the chain anchor to the last appended checkpoint on stop', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    count: 2,
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  await client.stopActivity({ avatarID: avatar.id });

  const tail = batch[1]!;

  const chain = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  expect(chain.appendedNextSeed).toBe(tail.payload.nextSeed);
  expect(chain.appendedChainIndex).toBe(tail.payload.chainIndex);
});

test('it leaves the anchor unchanged when nothing was appended', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const chainBefore = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  await client.stopActivity({ avatarID: avatar.id });

  const chainAfter = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  expect(chainAfter).toStrictEqual(chainBefore);
});

test('it leaves the anchor unchanged when only the Started checkpoint was appended', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const chainBefore = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { nextSeed: started.seed, seed: started.seed, type: 'started' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  await client.stopActivity({ avatarID: avatar.id });

  const chainAfter = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  expect(chainAfter).toStrictEqual(chainBefore);
});

test('it rejects a duplicate stop with NOT_FOUND and advances the anchor exactly once', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  await client.stopActivity({ avatarID: avatar.id });

  const chainAfterFirst = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  expect(client.stopActivity({ avatarID: avatar.id })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });

  const chainAfterSecond = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  expect(chainAfterSecond).toStrictEqual(chainAfterFirst);
});

test('it stops the targeted row when an activity id is named', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const stopped = await client.stopActivity({ activityID: started.id, avatarID: avatar.id });

  expect(stopped).toStrictEqual({
    ...started,
    status: 'stopped',
    stoppedAt: expect.toBeValidDate(),
    updatedAt: expect.toBeValidDate(),
  });
});

test('it succeeds idempotently when the targeted row already left active', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const stopped = await client.stopActivity({ activityID: started.id, avatarID: avatar.id });
  const repeated = await client.stopActivity({ activityID: started.id, avatarID: avatar.id });

  expect(repeated).toStrictEqual({ ...stopped, updatedAt: expect.toBeValidDate() });
});

test('it never stops a row other than the targeted one', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await client.stopActivity({ activityID: first.id, avatarID: avatar.id });

  const second = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  // a late redelivery of the first row's stop leaves the newer run untouched
  const redelivered = await client.stopActivity({ activityID: first.id, avatarID: avatar.id });

  expect(redelivered.id).toBe(first.id);
  expect(redelivered.status).toBe('stopped');

  const current = await client.getCurrentActivity({ avatarID: avatar.id });

  expect(current).toMatchObject({ id: second.id, status: 'active' });
});

test('it rejects a targeted stop for a row of another user with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const owner = await createViewer({ audience: 'service-activity', db: ctx.db });
  const ownerAvatar = await createAvatarRow(ctx.db, { userId: owner.user.id });

  const ownerClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: owner.token });

  const started = await ownerClient.startActivity({
    avatarID: ownerAvatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const intruder = await createViewer({ audience: 'service-activity', db: ctx.db });

  const intruderClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: intruder.token });

  expect(
    intruderClient.stopActivity({ activityID: started.id, avatarID: ownerAvatar.id }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it rejects a stop from a session another writer displaced with SESSION_EVICTED', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });
  const keyPair = await getTestServiceKeyPair();

  const tokenA = await createServiceToken({
    actingSessionId: 'session-a',
    actingUserId: viewer.user.id,
    audience: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const clientA = buildRPCTestClient<ActivityContract>(ctx.app, { token: tokenA });

  const started = await clientA.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const tokenB = await createServiceToken({
    actingSessionId: 'session-b',
    actingUserId: viewer.user.id,
    audience: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const clientB = buildRPCTestClient<ActivityContract>(ctx.app, { token: tokenB });

  await clientB.resumeActivity({ activityID: started.id });

  expect(
    clientA.stopActivity({ activityID: started.id, avatarID: avatar.id }),
  ).rejects.toMatchObject({ code: 'SESSION_EVICTED' });

  const row = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', started.id)
    .executeTakeFirst();

  expect(row?.status).toBe('active');
});

test('it still succeeds idempotently for a displaced session once the row left active', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });
  const keyPair = await getTestServiceKeyPair();

  const tokenA = await createServiceToken({
    actingSessionId: 'session-a',
    actingUserId: viewer.user.id,
    audience: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const clientA = buildRPCTestClient<ActivityContract>(ctx.app, { token: tokenA });

  const started = await clientA.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const tokenB = await createServiceToken({
    actingSessionId: 'session-b',
    actingUserId: viewer.user.id,
    audience: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const clientB = buildRPCTestClient<ActivityContract>(ctx.app, { token: tokenB });

  await clientB.resumeActivity({ activityID: started.id });
  await clientB.stopActivity({ activityID: started.id, avatarID: avatar.id });

  const settled = await clientA.stopActivity({ activityID: started.id, avatarID: avatar.id });

  expect(settled.status).toBe('stopped');
});

test('it attempts a wake delivery after a successful stop', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const wakeHandler = mock(() => ({ drained: 0 }));

  server.use(mockReplayService.wake.handler(wakeHandler));

  await client.stopActivity({ avatarID: avatar.id });

  await waitFor(
    () => {
      expect(wakeHandler).toHaveBeenCalledOnce();
    },
    { timeoutMs: 2000 },
  );
});
