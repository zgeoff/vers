import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import { buildFailureXPLoss, levelForXP } from '@vers/idle-core';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { createMockCheckpointBatch } from '../test-utils/factories/create-mock-checkpoint-batch';

/**
 * `trackActivityProgress` opens its own `db.transaction()` for the head-row CAS, which can't nest
 * under the default rollback-on-dispose isolation — this suite runs against a real, committed
 * schema clone instead.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });
  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it appends a single-entry batch and advances the head', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });

  const result = await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  expect(result).toStrictEqual({ appendedHead: 1 });

  const updated = await client.getCurrentActivity({ avatarID: avatar.id });

  expect(updated).toMatchObject({ appendedHead: 1, lastHash: batch[0]?.hash });
});

test('it advances cursors and lastHash across multiple sequential batches', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

  const firstBatch = createMockCheckpointBatch({
    count: 2,
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: firstBatch,
    expectedHead: 0,
  });

  const secondBatch = createMockCheckpointBatch({
    startPrevHash: firstBatch[1]?.hash ?? '',
    startVersion: 3,
  });

  const result = await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: secondBatch,
    expectedHead: 2,
  });

  expect(result).toStrictEqual({ appendedHead: 3 });

  const updated = await client.getCurrentActivity({ avatarID: avatar.id });

  expect(updated).toMatchObject({ appendedHead: 3, lastHash: secondBatch[0]?.hash });
});

test('it rejects a stale expectedHead with CONFLICT carrying the current head', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  const staleBatch = createMockCheckpointBatch({
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  expect(
    client.trackActivityProgress({
      activityID: started.id,
      checkpoints: staleBatch,
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({ code: 'CONFLICT', data: { appendedHead: 1 } });
});

test('it succeeds on a resend of the tail after a stale-head CONFLICT', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  const resend = createMockCheckpointBatch({
    startPrevHash: batch[0]?.hash ?? '',
    startVersion: 2,
  });

  const result = await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: resend,
    expectedHead: 1,
  });

  expect(result).toStrictEqual({ appendedHead: 2 });
});

test('it rejects a non-contiguous batch with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 2 });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({
    code: 'CHECKPOINT_INVALID',
    data: { reason: 'non-contiguous-versions' },
  });
});

test('it rejects a broken chain link with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

  const batch = createMockCheckpointBatch({
    count: 2,
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const tampered = [batch[0]!, { ...batch[1]!, prevHash: 'not-the-real-prev-hash' }];

  expect(
    client.trackActivityProgress({
      activityID: started.id,
      checkpoints: tampered,
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({ code: 'CHECKPOINT_INVALID', data: { reason: 'broken-chain-link' } });
});

test('it rejects a hash that does not match its payload with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });
  const tampered = [{ ...batch[0]!, hash: 'not-the-real-hash' }];

  expect(
    client.trackActivityProgress({
      activityID: started.id,
      checkpoints: tampered,
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({ code: 'CHECKPOINT_INVALID', data: { reason: 'hash-mismatch' } });
});

test('it rejects appending to a stopped activity with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

  await client.stopActivity({ avatarID: avatar.id });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it rejects a foreign or missing activity id with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.trackActivityProgress({ activityID: 'act_missing', checkpoints: [], expectedHead: 0 }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.trackActivityProgress({ activityID: 'act_1', checkpoints: [], expectedHead: 0 }),
  ).rejects.toMatchObject({ code: 'UNAUTHORIZED', data: { reason: 'missing-session' } });
});

test('it settles avatar xp and level from a completed terminal checkpoint', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

  const rewardsXP = 150;

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: rewardsXP }, type: 'completed' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  const updated = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(updated.xp).toBe(rewardsXP);
  expect(updated.level).toBe(levelForXP(rewardsXP));

  const updatedActivity = await ctx.db
    .selectFrom('activities')
    .selectAll()
    .where('id', '=', started.id)
    .executeTakeFirstOrThrow();

  expect(updatedActivity.status).toBe('stopped');
  expect(updatedActivity.stoppedAt).not.toBeNil();
});

test('it settles a clamped xp loss from a failed terminal checkpoint', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  // partway into a level, so the failure loss is nonzero but the ratchet still holds
  const startingXP = 150;

  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: startingXP });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

  const loss = buildFailureXPLoss(startingXP);
  const rewardsXP = -loss;

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: rewardsXP }, type: 'failed' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  const updated = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(loss).toBeGreaterThan(0);
  expect(updated.xp).toBe(startingXP + rewardsXP);
  expect(updated.level).toBe(levelForXP(startingXP + rewardsXP));
});

test('it does not double-apply xp on a duplicate terminal submission', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

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

  expect(
    client.trackActivityProgress({
      activityID: started.id,
      checkpoints: batch,
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });

  const updated = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(updated.xp).toBe(150);
});
