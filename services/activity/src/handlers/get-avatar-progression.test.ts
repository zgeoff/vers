import { expect, mock, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import type { ActivityContract } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { mockReplayService } from '@vers/mock-services/replay';
import {
  createActivityChainRow,
  createAnonymousViewer,
  createAvatarRow,
  createTestDB,
  createViewer,
} from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildRPCTestClient, waitFor } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';
import { server } from '../mocks/server';
import { createMockCheckpointBatch } from '../test-utils/factories/create-mock-checkpoint-batch';

/**
 * `trackActivityProgress` opens its own `db.transaction()` for the head-row compare-and-swap, which
 * can't nest under the default rollback-on-dispose isolation — this suite runs against a real,
 * committed schema clone instead.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);
  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

  const service = await createActivityService({ db: db.db, wakeCoalesceWindowMs: 0 });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns the settled xp and level with no pending entries for an avatar with no activities', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { level: 3, userId: viewer.user.id, xp: 450 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.getAvatarProgression({ avatarID: avatar.id });

  expect(result).toStrictEqual({ active: null, level: 3, pending: [], xp: 450 });
});

test("it includes a pending entry carrying the terminal checkpoint's rewards.xp for an unverified terminal activity", async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 150 }, type: 'completed' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  const result = await client.getAvatarProgression({ avatarID: avatar.id });

  expect(result).toStrictEqual({
    active: null,
    level: 1,
    pending: [{ activityID: started.id, xpDelta: 150 }],
    xp: 0,
  });
});

test('it excludes a verified activity from pending', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 150 }, type: 'completed' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  await ctx.db
    .updateTable('activities')
    .set({ verifiedAt: new Date(), verifiedHead: 1 })
    .where('id', '=', started.id)
    .execute();

  const result = await client.getAvatarProgression({ avatarID: avatar.id });

  expect(result).toStrictEqual({ active: null, level: 1, pending: [], xp: 0 });
});

test('it excludes a rejected activity from pending', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 150 }, type: 'completed' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'rejected' })
    .where('id', '=', started.id)
    .execute();

  const result = await client.getAvatarProgression({ avatarID: avatar.id });

  expect(result).toStrictEqual({ active: null, level: 1, pending: [], xp: 0 });
});

test('it excludes an active activity from pending', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  const result = await client.getAvatarProgression({ avatarID: avatar.id });

  expect(result).toStrictEqual({
    active: { activityID: started.id, settledXP: 0 },
    level: 1,
    pending: [],
    xp: 0,
  });
});

test('it reports how much of the live run the settled total already carries', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 90 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .updateTable('activities')
    .set({ settledXp: 90 })
    .where('id', '=', started.id)
    .execute();

  const result = await client.getAvatarProgression({ avatarID: avatar.id });

  expect(result).toStrictEqual({
    active: { activityID: started.id, settledXP: 90 },
    level: 1,
    pending: [],
    xp: 90,
  });
});

test('it includes the unsettled xp of a run stopped before its encounter finished', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    count: 2,
    finalPayloadOverrides: { rewards: { xp: 40 }, type: 'progress' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  await client.stopActivity({ avatarID: avatar.id });

  const result = await client.getAvatarProgression({ avatarID: avatar.id });

  expect(result).toStrictEqual({
    active: null,
    level: 1,
    pending: [{ activityID: started.id, xpDelta: 40 }],
    xp: 0,
  });
});

test('it reports unsettled xp that sums past what a database integer holds', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const first = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 2_147_483_647 }, type: 'progress' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: first,
    expectedHead: 0,
  });

  const second = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 2_147_483_647 }, type: 'progress' },
    startPrevHash: first[0]!.hash,
    startVersion: 2,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: second,
    expectedHead: 1,
  });

  await client.stopActivity({ avatarID: avatar.id });

  const result = await client.getAvatarProgression({ avatarID: avatar.id });

  expect(result).toStrictEqual({
    active: null,
    level: 1,
    pending: [{ activityID: started.id, xpDelta: 4_294_967_294 }],
    xp: 0,
  });
});

test('it skips a pending entry whose tail checkpoint carries no terminal rewards payload', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

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

  // a manual stop lands `stopped` on whatever checkpoint the stream was mid-run at, not a
  // completed/failed terminal — its payload carries no `rewards` field at all
  await client.stopActivity({ avatarID: avatar.id });

  const result = await client.getAvatarProgression({ avatarID: avatar.id });

  expect(result).toStrictEqual({ active: null, level: 1, pending: [], xp: 0 });
});

test('it returns null for an avatar owned by another caller', async () => {
  await using ctx = await setupTest();

  const owner = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: owner.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const otherViewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const otherClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: otherViewer.token });

  const result = await otherClient.getAvatarProgression({ avatarID: avatar.id });

  expect(result).toBeNull();
});

test('it returns null for a missing avatar', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.getAvatarProgression({ avatarID: 'avatar_missing' });

  expect(result).toBeNull();
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.getAvatarProgression({ avatarID: 'avatar_1' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

test('it attempts a wake delivery when a pending entry is present', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 150 }, type: 'completed' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  const wakeHandler = mock(() => ({ drained: 0 }));

  server.use(mockReplayService.wake.handler(wakeHandler));

  await client.getAvatarProgression({ avatarID: avatar.id });

  await waitFor(
    () => {
      expect(wakeHandler).toHaveBeenCalledOnce();
    },
    { timeoutMs: 2000 },
  );
});

test('it attempts no wake delivery when pending is empty', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { level: 3, userId: viewer.user.id, xp: 450 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });
  const wakeHandler = mock(() => ({ drained: 0 }));

  server.use(mockReplayService.wake.handler(wakeHandler));

  await client.getAvatarProgression({ avatarID: avatar.id });

  // no coalesce window to wait out below: the assertion is that nothing was ever sent, so there is
  // nothing in flight to await — a fixed pause is the only way to prove an absence
  await Bun.sleep(300);

  expect(wakeHandler).not.toHaveBeenCalled();
});
