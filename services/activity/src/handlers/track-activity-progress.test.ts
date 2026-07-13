import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import { buildFailureXPLoss, levelForXP } from '@vers/idle-core';
import {
  createAnonymousViewer,
  createServiceToken,
  createTestDB,
  createViewer,
  getTestServiceKeyPair,
} from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { createMockCheckpointBatch } from '../test-utils/factories/create-mock-checkpoint-batch';

/**
 * `trackActivityProgress` opens its own `db.transaction()` for the head-row compare-and-swap, which can't nest
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

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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

test('it rejects appending to a stopped activity with ACTIVITY_TERMINAL', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  await client.stopActivity({ avatarID: avatar.id });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });

  expect(
    client.trackActivityProgress({ activityID: started.id, checkpoints: batch, expectedHead: 0 }),
  ).rejects.toMatchObject({ code: 'ACTIVITY_TERMINAL', data: { status: 'stopped' } });
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

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

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

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

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

test('it advances the chain anchor to the terminal checkpoint on a completed batch', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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
    .where('scopeId', '=', 'node_1')
    .executeTakeFirstOrThrow();

  expect(chain.appendedNextSeed).toBe(terminal.payload.nextSeed);
  expect(chain.appendedChainIndex).toBe(terminal.payload.chainIndex);
});

test('it advances the chain anchor to the terminal checkpoint on a failed batch', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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
    .where('scopeId', '=', 'node_1')
    .executeTakeFirstOrThrow();

  expect(chain.appendedNextSeed).toBe(terminal.payload.nextSeed);
  expect(chain.appendedChainIndex).toBe(terminal.payload.chainIndex);
});

test('it continues the next activity on the same node from the previous terminal checkpoint', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const firstStarted = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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

  const secondStarted = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  expect(secondStarted.seed).toBe(terminal.payload.nextSeed);
  expect(secondStarted.startChainIndex).toBe(terminal.payload.chainIndex);
});

test('it moves nothing when a stale terminal replays the compare-and-swap at an anchor the chain has already passed', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const firstStarted = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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

  const secondStarted = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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
    .where('scopeId', '=', 'node_1')
    .executeTakeFirstOrThrow();

  // replays the first activity's own compare-and-swap, which the chain has already moved past
  await ctx.db
    .updateTable('activityChains')
    .set({ appendedChainIndex: 999, appendedNextSeed: 'replayed-seed' })
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', 'node_1')
    .where('appendedChainIndex', '=', firstStarted.startChainIndex)
    .execute();

  const anchorAfterReplay = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', 'node_1')
    .executeTakeFirstOrThrow();

  expect(anchorAfterReplay).toStrictEqual(anchorAfterSecond);
});

test('it rejects a chainIndex that is not startChainIndex plus version with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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

test('it advances the chain anchor exactly once across a duplicate terminal submission', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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

  const chainAfterFirst = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', 'node_1')
    .executeTakeFirstOrThrow();

  expect(
    client.trackActivityProgress({
      activityID: started.id,
      checkpoints: batch,
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({ code: 'ACTIVITY_TERMINAL', data: { status: 'stopped' } });

  const chainAfterSecond = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', 'node_1')
    .executeTakeFirstOrThrow();

  expect(chainAfterSecond).toStrictEqual(chainAfterFirst);
});

test('it does not double-apply xp on a duplicate terminal submission', async () => {
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

  expect(
    client.trackActivityProgress({
      activityID: started.id,
      checkpoints: batch,
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({ code: 'ACTIVITY_TERMINAL', data: { status: 'stopped' } });

  const updated = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(updated.xp).toBe(150);
});

test('it fences an append from a displaced writer session with SESSION_EVICTED', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({
    audience: 'service-activity',
    db: ctx.db,
    sessionID: 'session-a',
  });

  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const clientA = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await clientA.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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

  const sessionlessClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await sessionlessClient.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
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
