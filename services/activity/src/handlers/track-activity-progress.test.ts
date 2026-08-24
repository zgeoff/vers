import { expect, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import type { ActivityContract } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { buildFailureXPLoss } from '@vers/idle-core';
import {
  createActivityChainRow,
  createActivityRow,
  createAnonymousViewer,
  createAvatarRow,
  createServiceToken,
  createTestDB,
  createViewer,
  getTestServiceKeyPair,
} from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';
import { createMockCheckpointBatch } from '../test-utils/factories/create-mock-checkpoint-batch';

/**
 * `trackActivityProgress` opens its own `db.transaction()` for the head-row compare-and-swap, which can't nest
 * under the default rollback-on-dispose isolation — this suite runs against a real, committed
 * schema clone instead.
 */
async function setupTest(config: { readonly simTimeCapMs?: number } = {}) {
  const db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);
  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

  const service = await createActivityService({
    db: db.db,
    ...(config.simTimeCapMs !== undefined && { simTimeCapMs: config.simTimeCapMs }),
  });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it appends a single-entry batch and advances the head', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

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

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

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

test('it accepts a batch whose reward slots parse with contiguous ordinals', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: {
      rewardSlots: [
        { context: { nodeTier: 1 }, ordinal: 0 },
        { context: { nodeTier: 1 }, ordinal: 1 },
      ],
    },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const result = await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  expect(result).toStrictEqual({ appendedHead: 1 });
});

test('it rejects a batch whose reward slots do not parse with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewardSlots: [{ context: { nodeTier: 1 }, ordinal: -1 }] },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({
    code: 'CHECKPOINT_INVALID',
    data: { reason: 'invalid-reward-slots' },
  });
});

test('it rejects a batch whose reward slot ordinals are not contiguous from 0 with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: {
      rewardSlots: [
        { context: { nodeTier: 1 }, ordinal: 0 },
        { context: { nodeTier: 1 }, ordinal: 2 },
      ],
    },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({
    code: 'CHECKPOINT_INVALID',
    data: { reason: 'invalid-reward-slots' },
  });
});

test('it rejects a batch whose xp reward is fractional with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 1.5 } },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({
    code: 'CHECKPOINT_INVALID',
    data: { reason: 'invalid-rewards' },
  });
});

test('it rejects a batch whose xp reward is not a number with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 'lots' } },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({
    code: 'CHECKPOINT_INVALID',
    data: { reason: 'invalid-rewards' },
  });
});

test('it rejects a batch whose xp reward exceeds what the database column holds with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 2_147_483_648 } },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({
    code: 'CHECKPOINT_INVALID',
    data: { reason: 'invalid-rewards' },
  });
});

test('it appends a batch whose xp reward sits at the largest value the database column holds', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 2_147_483_647 } },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const result = await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  expect(result).toStrictEqual({ appendedHead: 1 });
});

test('it appends a batch whose rewards carry fields beside xp', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { gold: 3, xp: 40 } },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const result = await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  expect(result).toStrictEqual({ appendedHead: 1 });
});

test('it rejects appending to a stopped activity with ACTIVITY_TERMINAL', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  await client.stopActivity({ avatarID: avatar.id });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({ code: 'ACTIVITY_TERMINAL', data: { status: 'stopped' } });
});

test('it rejects a missing activity id with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.trackActivityProgress({ activityID: 'act_missing', checkpoints: [], expectedHead: 0 }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it rejects a foreign activity id with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const owner = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: owner.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const other = await createViewer({ audience: 'service-activity', db: ctx.db });

  const otherClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: other.token });

  expect(
    otherClient.trackActivityProgress({
      activityID: started.id,
      checkpoints: [],
      expectedHead: 0,
    }),
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

test('it leaves the avatar xp and level untouched on a completed terminal checkpoint', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
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

  const updated = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(updated.xp).toBe(0);
  expect(updated.level).toBe(avatar.level);

  const updatedActivity = await ctx.db
    .selectFrom('activities')
    .selectAll()
    .where('id', '=', started.id)
    .executeTakeFirstOrThrow();

  expect(updatedActivity.status).toBe('stopped');
  expect(updatedActivity.stoppedAt).not.toBeNil();
});

test('it leaves the avatar xp and level untouched on a failed terminal checkpoint', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  // partway into a level, so a settled failure loss would be nonzero if the request path applied it
  const startingXP = 150;

  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: startingXP });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const loss = buildFailureXPLoss(startingXP);

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: -loss }, type: 'failed' },
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
  expect(updated.xp).toBe(startingXP);
  expect(updated.level).toBe(avatar.level);
});

test('it advances the chain anchor to the terminal checkpoint on a completed batch', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 100 }, type: 'completed' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  const terminal = batch[0]!;

  const chain = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  expect(chain.appendedNextSeed).toBe(terminal.payload.nextSeed);
  expect(chain.appendedChainIndex).toBe(terminal.payload.chainIndex);
});

test('it advances the chain anchor to the terminal checkpoint on a failed batch', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: -10 }, type: 'failed' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  const terminal = batch[0]!;

  const chain = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  expect(chain.appendedNextSeed).toBe(terminal.payload.nextSeed);
  expect(chain.appendedChainIndex).toBe(terminal.payload.chainIndex);
});

test('it ends a run whose last checkpoint carries no rewards payload', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { type: 'completed' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  const activity = await ctx.db
    .selectFrom('activities')
    .selectAll()
    .where('id', '=', started.id)
    .executeTakeFirstOrThrow();

  const chain = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  expect(activity.status).toBe('stopped');
  expect(chain.appendedChainIndex).toBe(batch[0]!.payload.chainIndex);
});

test('it ends a run whose last checkpoint carries rewards without an xp figure', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: {}, type: 'failed' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  const activity = await ctx.db
    .selectFrom('activities')
    .selectAll()
    .where('id', '=', started.id)
    .executeTakeFirstOrThrow();

  expect(activity.status).toBe('stopped');
});

test('it advances the chain anchor when the terminal segment consumed no entropy', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  // A checkpoint's seed is its own segment's origin, so a terminal whose segment rolled nothing
  // carries nextSeed equal to seed while earlier checkpoints in the stream consumed entropy.
  const restingSeed = 'aaaabbbbccccdddd';

  const batch = createMockCheckpointBatch({
    count: 2,
    finalPayloadOverrides: {
      nextSeed: restingSeed,
      rewards: { xp: 100 },
      seed: restingSeed,
      type: 'completed',
    },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  const terminal = batch[1]!;

  const chain = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  expect(chain.appendedNextSeed).toBe(restingSeed);
  expect(chain.appendedChainIndex).toBe(terminal.payload.chainIndex);
});

test('it advances the node chain to the terminal checkpoint the next activity anchors at', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const firstStarted = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const firstBatch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 100 }, type: 'completed' },
    startPrevHash: firstStarted.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: firstStarted.id,
    checkpoints: firstBatch,
    expectedHead: 0,
  });

  const terminal = firstBatch[0]!;

  const chain = await ctx.db
    .selectFrom('activityChains')
    .select(['appendedNextSeed', 'appendedChainIndex'])
    .where('avatarId', '=', avatar.id)
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  // the next activity at this node anchors here, and an ingest whose start names any other
  // position is refused
  expect(chain.appendedNextSeed).toBe(terminal.payload.nextSeed);
  expect(chain.appendedChainIndex).toBe(terminal.payload.chainIndex);
});

test('it moves nothing when a stale terminal replays the compare-and-swap at an anchor the chain has already passed', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const firstStarted = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const firstBatch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 100 }, type: 'completed' },
    startPrevHash: firstStarted.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: firstStarted.id,
    checkpoints: firstBatch,
    expectedHead: 0,
  });

  const secondStarted = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const secondBatch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 100 }, type: 'completed' },
    startChainIndex: secondStarted.startChainIndex,
    startPrevHash: secondStarted.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: secondStarted.id,
    checkpoints: secondBatch,
    expectedHead: 0,
  });

  const anchorAfterSecond = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  // replays the first activity's own compare-and-swap, which the chain has already moved past
  await ctx.db
    .updateTable('activityChains')
    .set({ appendedChainIndex: 999, appendedNextSeed: 'replayed-seed' })
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .where('appendedChainIndex', '=', firstStarted.startChainIndex)
    .execute();

  const anchorAfterReplay = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  expect(anchorAfterReplay).toStrictEqual(anchorAfterSecond);
});

test('it rejects a chainIndex that is not startChainIndex plus version with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });
  const tampered = [{ ...batch[0]!, payload: { ...batch[0]!.payload, chainIndex: 99 } }];

  expect(
    client.trackActivityProgress({
      activityID: started.id,
      checkpoints: tampered,
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({
    code: 'CHECKPOINT_INVALID',
    data: { reason: 'non-contiguous-chain-index' },
  });
});

test('it rejects a batch that continues past a run-ending checkpoint with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const throughCompletion = createMockCheckpointBatch({
    count: 2,
    finalPayloadOverrides: { rewards: { xp: 40 }, type: 'completed' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const afterCompletion = createMockCheckpointBatch({
    startPrevHash: throughCompletion[1]!.hash,
    startVersion: 3,
  });

  expect(
    client.trackActivityProgress({
      activityID: started.id,
      checkpoints: [...throughCompletion, ...afterCompletion],
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({
    code: 'CHECKPOINT_INVALID',
    data: { reason: 'terminal-not-last' },
  });

  const current = await client.getCurrentActivity({ avatarID: avatar.id });

  expect(current).toMatchObject({ appendedHead: 0, status: 'active' });
});

test('it returns the settled head when a terminal batch is resubmitted unchanged', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 150 }, type: 'completed' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const firstResult = await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  expect(firstResult).toStrictEqual({ appendedHead: 1 });

  const chainAfterFirst = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  const resubmitResult = await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  expect(resubmitResult).toStrictEqual({ appendedHead: 1 });

  const chainAfterSecond = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  expect(chainAfterSecond).toStrictEqual(chainAfterFirst);

  const updatedAvatar = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(updatedAvatar.xp).toBe(0);

  const checkpoints = await ctx.db
    .selectFrom('activityCheckpoints')
    .selectAll()
    .where('activityId', '=', started.id)
    .execute();

  expect(checkpoints).toHaveLength(1);
});

test('it rejects a non-matching batch against a settled activity as terminal', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 100 }, type: 'completed' },
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  const tampered = [
    { ...batch[0]!, payload: { ...batch[0]!.payload, time: batch[0]!.payload.time + 1 } },
  ];

  expect(
    client.trackActivityProgress({
      activityID: started.id,
      checkpoints: tampered,
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({ code: 'ACTIVITY_TERMINAL', data: { status: 'stopped' } });
});

test('it returns the settled head when a landed batch is resubmitted after a user stop', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  await client.stopActivity({ avatarID: avatar.id });

  const resubmitResult = await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  expect(resubmitResult).toStrictEqual({ appendedHead: 1 });
});

test('it rejects an append from a displaced writer session with SESSION_EVICTED', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({
    audience: 'service-activity',
    db: ctx.db,
    sessionID: 'session-a',
  });

  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const clientA = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const keyPair = await getTestServiceKeyPair();

  const tokenB = await createServiceToken({
    actingSessionId: 'session-b',
    actingUserId: viewer.user.id,
    audience: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const clientB = buildRPCTestClient<ActivityContract>(ctx.app, { token: tokenB });

  await clientB.resumeActivity({ activityID: started.id });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });

  expect(
    clientA.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({ code: 'SESSION_EVICTED' });

  const result = await clientB.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  expect(result).toStrictEqual({ appendedHead: 1 });
});

test('it lets the first appending session claim an unstamped stream', async () => {
  await using ctx = await setupTest();

  // a session-less viewer starts the activity, leaving the writer unstamped
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const keyPair = await getTestServiceKeyPair();

  const tokenA = await createServiceToken({
    actingSessionId: 'session-a',
    actingUserId: viewer.user.id,
    audience: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const clientA = buildRPCTestClient<ActivityContract>(ctx.app, { token: tokenA });
  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });

  const result = await clientA.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  expect(result).toStrictEqual({ appendedHead: 1 });

  const tokenB = await createServiceToken({
    actingSessionId: 'session-b',
    actingUserId: viewer.user.id,
    audience: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const clientB = buildRPCTestClient<ActivityContract>(ctx.app, { token: tokenB });

  const nextBatch = createMockCheckpointBatch({
    startPrevHash: batch[0]?.hash ?? '',
    startVersion: 2,
  });

  expect(
    clientB.trackActivityProgress({
      activityID: started.id,
      checkpoints: nextBatch,
      expectedHead: 1,
    }),
  ).rejects.toMatchObject({ code: 'SESSION_EVICTED' });
});

test('it caps an append whose simulated time exceeds the accrued budget', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    simBudgetMs: 0,
    simMeteredAt: new Date(),
    userId: viewer.user.id,
  });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    startPrevHash: started.startHash,
    startVersion: 1,
    timeStepMs: 3_600_000,
  });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({ code: 'ACTIVITY_CAPPED', data: { appendedHead: 0 } });

  const updated = await ctx.db
    .selectFrom('activities')
    .selectAll()
    .where('id', '=', started.id)
    .executeTakeFirstOrThrow();

  expect(updated.status).toBe('capped');
  expect(updated.stoppedAt).not.toBeNil();
  expect(updated.appendedHead).toBe(0);

  const checkpoints = await ctx.db
    .selectFrom('activityCheckpoints')
    .selectAll()
    .where('activityId', '=', started.id)
    .execute();

  expect(checkpoints).toBeEmpty();
});

test('it accepts a batch whose simulated time fits the wall-clock accrued budget', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    simBudgetMs: 0,
    simMeteredAt: new Date(Date.now() - 3_600_000),
    userId: viewer.user.id,
  });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    startPrevHash: started.startHash,
    startVersion: 1,
    timeStepMs: 1_800_000,
  });

  const result = await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  expect(result).toStrictEqual({ appendedHead: 1 });

  const updated = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  // the hour of absence accrued, the half hour of simulated time was debited
  expect(Number(updated.simBudgetMs)).toBeWithin(1_700_000, 1_900_000);
});

test('it never accrues budget past the configured cap', async () => {
  await using ctx = await setupTest({ simTimeCapMs: 60_000 });

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    simBudgetMs: 0,
    simMeteredAt: new Date(Date.now() - 3_600_000),
    userId: viewer.user.id,
  });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const overCap = createMockCheckpointBatch({
    startPrevHash: started.startHash,
    startVersion: 1,
    timeStepMs: 100_000,
  });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: overCap, expectedHead: 0 }),
  ).rejects.toMatchObject({ code: 'ACTIVITY_CAPPED', data: { appendedHead: 0 } });
});

test('it accepts a batch at the cap after an hour of absence under a shrunken cap', async () => {
  await using ctx = await setupTest({ simTimeCapMs: 60_000 });

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    simBudgetMs: 0,
    simMeteredAt: new Date(Date.now() - 3_600_000),
    userId: viewer.user.id,
  });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const atCap = createMockCheckpointBatch({
    startPrevHash: started.startHash,
    startVersion: 1,
    timeStepMs: 50_000,
  });

  const result = await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: atCap,
    expectedHead: 0,
  });

  expect(result).toStrictEqual({ appendedHead: 1 });
});

test('it meters simulated time across consecutive activities on one avatar', async () => {
  await using ctx = await setupTest({ simTimeCapMs: 60_000 });

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    simBudgetMs: 50_000,
    simMeteredAt: new Date(),
    userId: viewer.user.id,
  });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const firstStarted = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const firstBatch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 10 }, type: 'completed' },
    startPrevHash: firstStarted.startHash,
    startVersion: 1,
    timeStepMs: 40_000,
  });

  await client.trackActivityProgress({
    activityID: firstStarted.id,
    checkpoints: firstBatch,
    expectedHead: 0,
  });

  const secondStarted = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const withinRemainder = createMockCheckpointBatch({
    startChainIndex: secondStarted.startChainIndex,
    startPrevHash: secondStarted.startHash,
    startVersion: 1,
    timeStepMs: 5000,
  });

  const accepted = await client.trackActivityProgress({
    activityID: secondStarted.id,
    checkpoints: withinRemainder,
    expectedHead: 0,
  });

  expect(accepted).toStrictEqual({ appendedHead: 1 });

  // the first activity's 40s and this stream's 5s came out of the same budget, so the remaining
  // ~5s cannot cover another 35s of simulated time
  const overRemainder = createMockCheckpointBatch({
    startChainIndex: secondStarted.startChainIndex,
    startPrevHash: withinRemainder[0]?.hash ?? '',
    startVersion: 2,
    timeStepMs: 20_000,
  });

  expect(
    client.trackActivityProgress({
      activityID: secondStarted.id,
      checkpoints: overRemainder,
      expectedHead: 1,
    }),
  ).rejects.toMatchObject({ code: 'ACTIVITY_CAPPED', data: { appendedHead: 1 } });
});

test('it sustains a live flush cadence on the default budget grant', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  let prevHash = started.startHash;

  for (let head = 0; head < 4; head += 1) {
    const batch = createMockCheckpointBatch({
      startPrevHash: prevHash,
      startVersion: head + 1,
    });

    const result = await client.trackActivityProgress({
      activityID: started.id,
      checkpoints: batch,
      expectedHead: head,
    });

    expect(result).toStrictEqual({ appendedHead: head + 1 });

    prevHash = batch[0]?.hash ?? '';
  }

  const updated = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  // the grant absorbs the 4s of simulated time that outran the test's near-zero wall clock
  expect(Number(updated.simBudgetMs)).toBeWithin(295_000, 300_001);
});

test('it answers a resubmission after a cap with the terminal status and stop index', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    simBudgetMs: 0,
    simMeteredAt: new Date(),
    userId: viewer.user.id,
  });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    startPrevHash: started.startHash,
    startVersion: 1,
    timeStepMs: 3_600_000,
  });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({ code: 'ACTIVITY_CAPPED' });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({
    code: 'ACTIVITY_TERMINAL',
    data: { appendedHead: 0, status: 'capped' },
  });
});

test('it consumes no budget and leaves the meter anchor untouched on a cap trip', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    simBudgetMs: 0,
    simMeteredAt: new Date(),
    userId: viewer.user.id,
  });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    startPrevHash: started.startHash,
    startVersion: 1,
    timeStepMs: 3_600_000,
  });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({ code: 'ACTIVITY_CAPPED' });

  const updated = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(Number(updated.simBudgetMs)).toBe(0);
  expect(updated.simMeteredAt).toStrictEqual(avatar.simMeteredAt);
});

test('it leaves the anchor unchanged when a cap trips before anything appended', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    simBudgetMs: 0,
    simMeteredAt: new Date(),
    userId: viewer.user.id,
  });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const chainBefore = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  const batch = createMockCheckpointBatch({
    startPrevHash: started.startHash,
    startVersion: 1,
    timeStepMs: 3_600_000,
  });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({ code: 'ACTIVITY_CAPPED' });

  const chainAfter = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  expect(chainAfter).toStrictEqual(chainBefore);
});

test('it advances the chain anchor to the pre-batch tail on a cap trip', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    simBudgetMs: 10_000,
    simMeteredAt: new Date(),
    userId: viewer.user.id,
  });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const firstBatch = createMockCheckpointBatch({
    startPrevHash: started.startHash,
    startVersion: 1,
    timeStepMs: 5000,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: firstBatch,
    expectedHead: 0,
  });

  const overCap = createMockCheckpointBatch({
    startPrevHash: firstBatch[0]?.hash ?? '',
    startVersion: 2,
    timeStepMs: 3_600_000,
  });

  expect(
    client.trackActivityProgress({
      activityID: started.id,
      checkpoints: overCap,
      expectedHead: 1,
    }),
  ).rejects.toMatchObject({ code: 'ACTIVITY_CAPPED' });

  const tail = firstBatch[0]!;

  const chainAfter = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  expect(chainAfter.appendedNextSeed).toBe(tail.payload.nextSeed);
  expect(chainAfter.appendedChainIndex).toBe(tail.payload.chainIndex);
});

test('it rejects a batch whose time regresses within the batch with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    count: 2,
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const tampered = [batch[0]!, { ...batch[1]!, payload: { ...batch[1]!.payload, time: 1 } }];

  expect(
    client.trackActivityProgress({
      activityID: started.id,
      checkpoints: tampered,
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({ code: 'CHECKPOINT_INVALID', data: { reason: 'time-regression' } });
});

test('it rejects a batch whose time regresses below the already accounted time with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const firstBatch = createMockCheckpointBatch({
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: firstBatch,
    expectedHead: 0,
  });

  // chain-valid continuation whose cumulative time lands below the head's accounted 1000ms
  const regressing = createMockCheckpointBatch({
    startPrevHash: firstBatch[0]?.hash ?? '',
    startVersion: 2,
    timeStepMs: 400,
  });

  expect(
    client.trackActivityProgress({
      activityID: started.id,
      checkpoints: regressing,
      expectedHead: 1,
    }),
  ).rejects.toMatchObject({ code: 'CHECKPOINT_INVALID', data: { reason: 'time-regression' } });
});

test('it debits the meter on a terminal batch that leaves xp settlement to the verifier', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 150 }, type: 'completed' },
    startPrevHash: started.startHash,
    startVersion: 1,
    timeStepMs: 10_000,
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

  expect(updated.xp).toBe(0);
  expect(Number(updated.simBudgetMs)).toBeWithin(289_000, 291_000);
});

test('it leaves the meter untouched on an empty batch', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    simMeteredAt: new Date(Date.now() - 3_600_000),
    userId: viewer.user.id,
  });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const result = await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: [],
    expectedHead: 0,
  });

  expect(result).toStrictEqual({ appendedHead: 0 });

  const updated = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(Number(updated.simBudgetMs)).toBe(300_000);
  expect(updated.simMeteredAt).toStrictEqual(avatar.simMeteredAt);
});
