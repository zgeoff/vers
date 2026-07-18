import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { createMockCheckpointBatch } from '../test-utils/factories/create-mock-checkpoint-batch';

/**
 * `trackActivityProgress` opens its own `db.transaction()` for the head-row compare-and-swap, which
 * can't nest under the default rollback-on-dispose isolation — this suite runs against a real,
 * committed schema clone instead.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);

  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns the settled xp and level with no pending entries for an avatar with no activities', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { level: 3, userId: viewer.user.id, xp: 450 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.getAvatarProgression({ avatarID: avatar.id });

  expect(result).toStrictEqual({ level: 3, pending: [], xp: 450 });
});

test("it includes a pending entry carrying the terminal checkpoint's rewards.xp for an unverified terminal activity", async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
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
    level: 1,
    pending: [{ activityID: started.id, xpDelta: 150 }],
    xp: 0,
  });
});

test('it excludes a verified activity from pending', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
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

  expect(result).toStrictEqual({ level: 1, pending: [], xp: 0 });
});

test('it excludes a rejected activity from pending', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
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

  expect(result).toStrictEqual({ level: 1, pending: [], xp: 0 });
});

test('it excludes an active activity from pending', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  const result = await client.getAvatarProgression({ avatarID: avatar.id });

  expect(result).toStrictEqual({ level: 1, pending: [], xp: 0 });
});

test('it skips a pending entry whose tail checkpoint carries no terminal rewards payload', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
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

  expect(result).toStrictEqual({ level: 1, pending: [], xp: 0 });
});

test('it returns null for an avatar owned by another caller', async () => {
  await using ctx = await setupTest();

  const owner = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: owner.user.id });
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
