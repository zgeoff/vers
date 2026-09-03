import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { createContentVersion } from '@vers/content-registry';
import type {
  ActivityContract,
  CatchUpContinuation,
  CheckpointBatchEntry,
  ContentDocument,
  EncounterNode,
} from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { buildLevelFromXP, foldOptimisticBuild } from '@vers/idle-core';
import { buildMockScopeSecret } from '@vers/mock-services/keys';
import {
  createActiveAvatarRow,
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
import { deriveWorldmapContent } from '@vers/worldmap-content';
import { collectNodeEdges, findCellCoord, getDifficulty } from '@vers/worldmap-core';
import invariant from 'tiny-invariant';
import { createActivityService } from '../create-activity-service';
import { createMockActivity } from '../test-utils/factories/create-mock-activity';
import { createMockCatchUpContinuation } from '../test-utils/factories/create-mock-catch-up-continuation';
import { createMockCheckpointBatch } from '../test-utils/factories/create-mock-checkpoint-batch';
import { createMockOfflineActivityStartSubmission } from '../test-utils/factories/create-mock-offline-activity-start-submission';
import { toActivityData } from './to-activity-data';

// the handler under test opens its own interactive transaction, which the default
// transaction-isolation handle can't nest — this suite runs against a real, committed schema clone
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

interface RowContext {
  readonly contentVersion: string;
  readonly encounterNode: { readonly difficulty: number };
  readonly keyVersion: number;
  readonly simVersion: string;
  readonly startChainIndex: number;
}

function buildMintedRowContext(
  preceding: Readonly<RowContext>,
  tail: ReadonlyArray<CheckpointBatchEntry>,
): RowContext & { readonly seed: string; readonly startHash: string } {
  const last = tail.at(-1);

  invariant(last !== undefined, 'a continuation always carries at least one checkpoint');

  const seed = last.payload.nextSeed;
  const startChainIndex = preceding.startChainIndex + last.version;

  const startHash = buildStartHash({
    contentVersion: preceding.contentVersion,
    encounterNode: preceding.encounterNode,
    keyVersion: preceding.keyVersion,
    seed,
    simVersion: preceding.simVersion,
  });

  return { ...preceding, seed, startChainIndex, startHash };
}

interface ActivityStartDerivationInput {
  readonly avatarID: string;
  readonly avatarSeed: number;
  readonly contentVersion: string;
  readonly document: ContentDocument;
  readonly scopeID: string;
  readonly seed: string;
  readonly simVersion: string;
}

function deriveActivityStart(input: Readonly<ActivityStartDerivationInput>): {
  encounterNode: EncounterNode;
  startHash: string;
} {
  const coord = findCellCoord(input.scopeID);

  invariant(coord, `scope id ${input.scopeID} must resolve to a valid cell coordinate`);

  const scopeSecret = buildMockScopeSecret(input.avatarID, 'worldmap', 1);

  const encounterNode = {
    difficulty: getDifficulty(coord[0], coord[1]),
    ...deriveWorldmapContent(input.document.encounter, {
      coord,
      scopeSecret,
      userSeed: input.avatarSeed,
    }),
  };

  const startHash = buildStartHash({
    contentVersion: input.contentVersion,
    encounterNode,
    keyVersion: 1,
    seed: input.seed,
    simVersion: input.simVersion,
  });

  return { encounterNode, startHash };
}

test('it mint-and-appends a two-continuation chain, returning the final freshly minted row', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const firstTail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 40 }, type: 'completed' },
    startChainIndex: started.startChainIndex,
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const rowB = buildMintedRowContext(toActivityData(started), firstTail);

  const secondTail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 25 }, type: 'completed' },
    startChainIndex: rowB.startChainIndex,
    startPrevHash: rowB.startHash,
    startVersion: 1,
  });

  const rowC = buildMintedRowContext(rowB, secondTail);

  const firstContinuation: CatchUpContinuation = {
    buildSnapshot: { level: buildLevelFromXP(40), xp: 40 },
    checkpoints: firstTail,
    id: `act_${createId()}`,
    startKey: `continue_${started.id}`,
  };

  const secondContinuation: CatchUpContinuation = {
    buildSnapshot: { level: buildLevelFromXP(65), xp: 65 },
    checkpoints: secondTail,
    id: `act_${createId()}`,
    startKey: `continue_${firstContinuation.id}`,
  };

  const continuations = [firstContinuation, secondContinuation];

  const result = await client.advanceActivity({
    activityID: started.id,
    continuations,
    expectedHead: 0,
  });

  expect(result).toMatchObject({
    activity: {
      appendedHead: 0,
      buildSnapshot: { level: buildLevelFromXP(65), xp: 65 },
      id: continuations[1]!.id,
      seed: rowC.seed,
      startChainIndex: rowC.startChainIndex,
      startHash: rowC.startHash,
      status: 'active',
    },
    appendedHead: 0,
  });

  const rows = await ctx.db
    .selectFrom('activities')
    .select(['id', 'status', 'appendedHead', 'buildSnapshot'])
    .where('avatarId', '=', avatar.id)
    .orderBy('startedAt', 'asc')
    .execute();

  expect(rows).toStrictEqual([
    { appendedHead: 1, buildSnapshot: { level: 1, xp: 0 }, id: started.id, status: 'stopped' },
    {
      appendedHead: 1,
      buildSnapshot: { level: buildLevelFromXP(40), xp: 40 },
      id: continuations[0]!.id,
      status: 'stopped',
    },
    {
      appendedHead: 0,
      buildSnapshot: { level: buildLevelFromXP(65), xp: 65 },
      id: continuations[1]!.id,
      status: 'active',
    },
  ]);
});

test('it carries the closing row secretRef/secretVersion forward onto a minted continuation', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  expect(started.secretRef).not.toBeNull();
  expect(started.secretVersion).not.toBeNull();

  const tail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 40 }, type: 'completed' },
    startChainIndex: started.startChainIndex,
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const continuation = createMockCatchUpContinuation({
    buildSnapshot: { level: buildLevelFromXP(40), xp: 40 },
    checkpoints: tail,
    startKey: `continue_${started.id}`,
  });

  const result = await client.advanceActivity({
    activityID: started.id,
    continuations: [continuation],
    expectedHead: 0,
  });

  expect(result.activity.secretRef).toBe(started.secretRef);
  expect(result.activity.secretVersion).toBe(started.secretVersion);

  const rows = await ctx.db
    .selectFrom('activities')
    .select(['id', 'secretRef', 'secretVersion'])
    .where('avatarId', '=', avatar.id)
    .orderBy('startedAt', 'asc')
    .execute();

  expect(rows).toStrictEqual([
    { id: started.id, secretRef: started.secretRef, secretVersion: started.secretVersion },
    { id: continuation.id, secretRef: started.secretRef, secretVersion: started.secretVersion },
  ]);
});

test('it rejects a continuation whose predicted buildSnapshot mismatches the server-authored one', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const tail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 40 }, type: 'completed' },
    startChainIndex: started.startChainIndex,
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const request = client.advanceActivity({
    activityID: started.id,
    continuations: [
      {
        // the honest total is 40, not 999 — a client that over-predicts (or a tampered payload)
        buildSnapshot: { level: buildLevelFromXP(999), xp: 999 },
        checkpoints: tail,
        id: `act_${createId()}`,
        startKey: `continue_${started.id}`,
      },
    ],
    expectedHead: 0,
  });

  // `.rejects` chains type as synchronous and are ordinarily left unawaited, but the trailing
  // query below must observe the rejected call's transaction fully settled — draining it here
  // guarantees that ordering before the shape assertion below runs against the settled promise.
  await request.catch(() => {});

  expect(request).rejects.toMatchObject({
    code: 'CHECKPOINT_INVALID',
    data: { activityID: started.id, appendedHead: 0, reason: 'build-snapshot-mismatch' },
  });

  // the append itself rolled back with the mint — the source row never left active
  const row = await ctx.db
    .selectFrom('activities')
    .select(['status', 'appendedHead'])
    .where('id', '=', started.id)
    .executeTakeFirstOrThrow();

  expect(row).toStrictEqual({ appendedHead: 0, status: 'active' });
});

test('it converges a resubmit of an already-minted continuation onto the same row', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const tail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 40 }, type: 'completed' },
    startChainIndex: started.startChainIndex,
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const continuation: CatchUpContinuation = {
    buildSnapshot: { level: buildLevelFromXP(40), xp: 40 },
    checkpoints: tail,
    id: `act_${createId()}`,
    startKey: `continue_${started.id}`,
  };

  const first = await client.advanceActivity({
    activityID: started.id,
    continuations: [continuation],
    expectedHead: 0,
  });

  const second = await client.advanceActivity({
    activityID: started.id,
    continuations: [continuation],
    expectedHead: 0,
  });

  expect(second).toStrictEqual(first);

  const rows = await ctx.db
    .selectFrom('activities')
    .select(['id'])
    .where('avatarId', '=', avatar.id)
    .execute();

  // no duplicate row was minted by the resubmit
  expect(rows).toHaveLength(2);
});

test('it conflicts a mint whose client id already belongs to another avatar', async () => {
  await using ctx = await setupTest();

  const viewerA = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatarA = await createAvatarRow(ctx.db, { userId: viewerA.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatarA.id, scopeId: '0_0' });

  const clientA = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewerA.token });

  const startedA = await createActivityRow(ctx.db, {
    avatarId: avatarA.id,
    scopeId: '0_0',
  });

  const viewerB = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatarB = await createAvatarRow(ctx.db, { userId: viewerB.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatarB.id, scopeId: '0_0' });

  const clientB = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewerB.token });

  const startedB = await createActivityRow(ctx.db, {
    avatarId: avatarB.id,
    scopeId: '0_0',
  });

  const tailA = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 10 }, type: 'completed' },
    startChainIndex: startedA.startChainIndex,
    startPrevHash: startedA.startHash,
    startVersion: 1,
  });

  const foreignID = `act_${createId()}`;

  await clientA.advanceActivity({
    activityID: startedA.id,
    continuations: [
      {
        buildSnapshot: { level: buildLevelFromXP(10), xp: 10 },
        checkpoints: tailA,
        id: foreignID,
        startKey: `continue_${startedA.id}`,
      },
    ],
    expectedHead: 0,
  });

  const tailB = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 5 }, type: 'completed' },
    startChainIndex: startedB.startChainIndex,
    startPrevHash: startedB.startHash,
    startVersion: 1,
  });

  expect(
    clientB.advanceActivity({
      activityID: startedB.id,
      continuations: [
        {
          buildSnapshot: { level: buildLevelFromXP(5), xp: 5 },
          checkpoints: tailB,
          id: foreignID,
          startKey: `continue_${startedB.id}`,
        },
      ],
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({
    code: 'CONFLICT',
    data: { activityID: startedB.id, appendedHead: 0 },
  });
});

test('it conflicts a mint whose client id collides with an unrelated row for the same avatar', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const reusedID = `act_${createId()}`;

  // an unrelated row for the same avatar that happens to reuse this id — never a continuation of
  // `started`, so its own `startKey` never matches `continue_${started.id}`
  await ctx.db
    .insertInto('activities')
    .values(
      createMockActivity({
        avatarId: avatar.id,
        id: reusedID,
        scopeId: '0_0',
        scopeType: 'world_map_node',
        startKey: 'continue_unrelated',
        status: 'stopped',
      }),
    )
    .execute();

  const tail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 10 }, type: 'completed' },
    startChainIndex: started.startChainIndex,
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const request = client.advanceActivity({
    activityID: started.id,
    continuations: [
      {
        buildSnapshot: { level: buildLevelFromXP(10), xp: 10 },
        checkpoints: tail,
        id: reusedID,
        startKey: `continue_${started.id}`,
      },
    ],
    expectedHead: 0,
  });

  // `.rejects` chains type as synchronous and are ordinarily left unawaited, but the trailing
  // query below must observe the rejected call's transaction fully settled — draining it here
  // guarantees that ordering before the shape assertion below runs against the settled promise.
  await request.catch(() => {});

  expect(request).rejects.toMatchObject({
    code: 'CONFLICT',
    data: { activityID: started.id, appendedHead: 0 },
  });

  // the mismatch is rejected outright, never adopted as the append target: the unrelated row is
  // untouched and the source row's own append rolled back with the mint it was blocked from
  const decoy = await ctx.db
    .selectFrom('activities')
    .select(['status', 'startKey'])
    .where('id', '=', reusedID)
    .executeTakeFirstOrThrow();

  expect(decoy).toStrictEqual({ startKey: 'continue_unrelated', status: 'stopped' });

  const row = await ctx.db
    .selectFrom('activities')
    .select(['status', 'appendedHead'])
    .where('id', '=', started.id)
    .executeTakeFirstOrThrow();

  expect(row).toStrictEqual({ appendedHead: 0, status: 'active' });
});

test('it caps a continuation whose tail exceeds the accrued offline budget', async () => {
  await using ctx = await setupTest({ simTimeCapMs: 60_000 });

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    simBudgetMs: 0,
    simMeteredAt: new Date(Date.now() - 3_600_000),
    userId: viewer.user.id,
    xp: 0,
  });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const overCapTail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 40 }, type: 'completed' },
    startChainIndex: started.startChainIndex,
    startPrevHash: started.startHash,
    startVersion: 1,
    timeStepMs: 100_000,
  });

  const request = client.advanceActivity({
    activityID: started.id,
    continuations: [
      {
        buildSnapshot: { level: buildLevelFromXP(40), xp: 40 },
        checkpoints: overCapTail,
        id: `act_${createId()}`,
        startKey: `continue_${started.id}`,
      },
    ],
    expectedHead: 0,
  });

  // `.rejects` chains type as synchronous and are ordinarily left unawaited, but the trailing
  // query below must observe the rejected call's transaction fully settled — draining it here
  // guarantees that ordering before the shape assertion below runs against the settled promise.
  await request.catch(() => {});

  expect(request).rejects.toMatchObject({
    code: 'ACTIVITY_CAPPED',
    data: { activityID: started.id, appendedHead: 0 },
  });

  const row = await ctx.db
    .selectFrom('activities')
    .select(['status'])
    .where('id', '=', started.id)
    .executeTakeFirstOrThrow();

  expect(row.status).toBe('capped');
});

test('it evicts a session that is no longer the writer', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({
    audience: 'service-activity',
    db: ctx.db,
    sessionID: 'session-a',
  });

  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  await ctx.db
    .updateTable('activities')
    .set({ writerSessionId: 'session-b' })
    .where('id', '=', started.id)
    .execute();

  const tail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 10 }, type: 'completed' },
    startChainIndex: started.startChainIndex,
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  expect(
    client.advanceActivity({
      activityID: started.id,
      continuations: [
        {
          buildSnapshot: { level: buildLevelFromXP(10), xp: 10 },
          checkpoints: tail,
          id: `act_${createId()}`,
          startKey: `continue_${started.id}`,
        },
      ],
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({
    code: 'SESSION_EVICTED',
    data: { activityID: started.id, appendedHead: 0 },
  });
});

test('it bails with CHAIN_QUARANTINED when the scope already carries a quarantined row', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  await ctx.db
    .insertInto('activities')
    .values(
      createMockActivity({
        avatarId: avatar.id,
        scopeId: '0_0',
        scopeType: 'world_map_node',
        status: 'quarantined',
      }),
    )
    .execute();

  const tail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 10 }, type: 'completed' },
    startChainIndex: started.startChainIndex,
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const request = client.advanceActivity({
    activityID: started.id,
    continuations: [
      {
        buildSnapshot: { level: buildLevelFromXP(10), xp: 10 },
        checkpoints: tail,
        id: `act_${createId()}`,
        startKey: `continue_${started.id}`,
      },
    ],
    expectedHead: 0,
  });

  // `.rejects` chains type as synchronous and are ordinarily left unawaited, but the trailing
  // query below must observe the rejected call's transaction fully settled — draining it here
  // guarantees that ordering before the shape assertion below runs against the settled promise.
  await request.catch(() => {});

  expect(request).rejects.toMatchObject({
    code: 'CHAIN_QUARANTINED',
    data: { activityID: started.id, appendedHead: 0 },
  });

  // the tail's own append rolled back along with the mint it was blocked from
  const row = await ctx.db
    .selectFrom('activities')
    .select(['status', 'appendedHead'])
    .where('id', '=', started.id)
    .executeTakeFirstOrThrow();

  expect(row).toStrictEqual({ appendedHead: 0, status: 'active' });
});

test('it bails with CHECKPOINT_INVALID on a broken hash chain, leaving the head at the last committed continuation', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const firstTail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 40 }, type: 'completed' },
    startChainIndex: started.startChainIndex,
    startPrevHash: started.startHash,
    startVersion: 1,
  });

  const rowB = buildMintedRowContext(toActivityData(started), firstTail);

  const brokenSecondTail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 25 }, type: 'completed' },
    startChainIndex: rowB.startChainIndex,

    // wrong prevHash: the tail no longer links onto rowB's own start hash
    startPrevHash: 'deadbeef',
    startVersion: 1,
  });

  const firstContinuationID = `act_${createId()}`;

  const request = client.advanceActivity({
    activityID: started.id,
    continuations: [
      {
        buildSnapshot: { level: buildLevelFromXP(40), xp: 40 },
        checkpoints: firstTail,
        id: firstContinuationID,
        startKey: `continue_${started.id}`,
      },
      {
        buildSnapshot: { level: buildLevelFromXP(65), xp: 65 },
        checkpoints: brokenSecondTail,
        id: `act_${createId()}`,
        startKey: `continue_${firstContinuationID}`,
      },
    ],
    expectedHead: 0,
  });

  // `.rejects` chains type as synchronous and are ordinarily left unawaited, but the trailing
  // query below must observe the rejected call's transaction fully settled — draining it here
  // guarantees that ordering before the shape assertion below runs against the settled promise.
  await request.catch(() => {});

  expect(request).rejects.toMatchObject({
    code: 'CHECKPOINT_INVALID',
    data: { activityID: firstContinuationID, appendedHead: 0 },
  });

  const rows = await ctx.db
    .selectFrom('activities')
    .select(['id', 'status', 'appendedHead'])
    .where('avatarId', '=', avatar.id)
    .orderBy('startedAt', 'asc')
    .execute();

  // the first continuation's mint-and-append committed; the second, broken one never did — the
  // request bailed strictly short of the full plan, with forward progress preserved
  expect(rows).toStrictEqual([
    { appendedHead: 1, id: started.id, status: 'stopped' },
    { appendedHead: 0, id: firstContinuationID, status: 'active' },
  ]);
});

test('it rejects an activity owned by another caller with NOT_FOUND', async () => {
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
    otherClient.advanceActivity({
      activityID: started.id,
      continuations: [createMockCatchUpContinuation()],
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.advanceActivity({
      activityID: 'activity_1',
      continuations: [createMockCatchUpContinuation()],
      expectedHead: 0,
    }),
  ).rejects.toMatchObject({ code: 'UNAUTHORIZED', data: { reason: 'missing-session' } });
});

test('it admits a client-minted activityStart under a valid client head, deriving its encounter and stamps server-side', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });
  const chain = await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const activityID = `act_${createId()}`;

  // the same content document `setupTest` published as version 2, so the derivation reproduced here
  // reads the encounter the server derives against
  const document = createMockContentDocument({ contentVersion: '2' });

  const derived = deriveActivityStart({
    avatarID: avatar.id,
    avatarSeed: avatar.seed,
    contentVersion: '2',
    document,
    scopeID: '0_0',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
  });

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    buildSnapshot: { level: buildLevelFromXP(0), xp: 0 },
    contentVersion: '2',
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
    startChainIndex: 0,
    startHash: derived.startHash,
  });

  const tail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 40 }, type: 'completed' },
    startChainIndex: activityStart.startChainIndex,
    startPrevHash: activityStart.startHash,
    startVersion: 1,
  });

  const continuation = createMockCatchUpContinuation({
    buildSnapshot: { level: buildLevelFromXP(40), xp: 40 },
    checkpoints: tail,
    startKey: `continue_${activityID}`,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.advanceActivity({
    activityID,
    continuations: [continuation],
    expectedHead: 0,
    activityStart,
  });

  expect(result.activity.id).toBe(continuation.id);

  const activityStartRow = await ctx.db
    .selectFrom('activities')
    .selectAll()
    .where('id', '=', activityID)
    .executeTakeFirstOrThrow();

  expect(activityStartRow).toMatchObject({
    avatarId: avatar.id,
    buildSnapshot: activityStart.buildSnapshot,
    contentVersion: activityStart.contentVersion,

    // encounter and stamps derived from server truth, never the client payload
    encounterNode: derived.encounterNode,
    keyVersion: 1,
    scopeId: activityStart.scopeID,
    scopeType: activityStart.scopeType,
    secretRef: 'worldmap',
    secretVersion: 1,
    seed: activityStart.seed,
    simVersion: activityStart.simVersion,
    startChainIndex: activityStart.startChainIndex,
    startHash: activityStart.startHash,
    startKey: activityStart.startKey,
    status: 'stopped',
  });
});

test('it mints an activity start naming a predecessor not yet on the server, stamping the reference as-is', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });
  const chain = await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const activityID = `act_${createId()}`;
  const predecessorID = `act_${createId()}`;
  const document = createMockContentDocument({ contentVersion: '2' });

  const derived = deriveActivityStart({
    avatarID: avatar.id,
    avatarSeed: avatar.seed,
    contentVersion: '2',
    document,
    scopeID: '0_0',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
  });

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    buildSnapshot: { level: buildLevelFromXP(0), xp: 0 },
    contentVersion: '2',
    predecessorActivityID: predecessorID,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
    startChainIndex: 0,
    startHash: derived.startHash,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  // an absent predecessor is not rejected — the activity start is admitted and the replay claim waits on
  // the predecessor, so an out-of-order or reload-orphaned delivery settles once it lands
  const minted = await client.advanceActivity({
    activityID,
    continuations: [],
    expectedHead: 0,
    activityStart,
  });

  expect(minted.activity.id).toBe(activityID);

  const mintedRow = await ctx.db
    .selectFrom('activities')
    .select('predecessorActivityId')
    .where('id', '=', activityID)
    .executeTakeFirstOrThrow();

  expect(mintedRow.predecessorActivityId).toBe(predecessorID);
});

test('it converges a sequential activityStart retry onto the existing row without double-minting', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });
  const chain = await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const activityID = `act_${createId()}`;
  const document = createMockContentDocument({ contentVersion: '2' });

  const derived = deriveActivityStart({
    avatarID: avatar.id,
    avatarSeed: avatar.seed,
    contentVersion: '2',
    document,
    scopeID: '0_0',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
  });

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    buildSnapshot: { level: buildLevelFromXP(0), xp: 0 },
    contentVersion: '2',
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
    startChainIndex: 0,
    startHash: derived.startHash,
  });

  const tail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 40 }, type: 'completed' },
    startChainIndex: activityStart.startChainIndex,
    startPrevHash: activityStart.startHash,
    startVersion: 1,
  });

  const continuation = createMockCatchUpContinuation({
    buildSnapshot: { level: buildLevelFromXP(40), xp: 40 },
    checkpoints: tail,
    startKey: `continue_${activityID}`,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });
  const request = { activityID, continuations: [continuation], expectedHead: 0, activityStart };

  // a sequential resubmit of the same activity start converges on the minted row instead of
  // double-minting; the concurrent-insert race that loses a unique violation is a separate case
  const first = await client.advanceActivity(request);
  const second = await client.advanceActivity(request);

  expect(second).toStrictEqual(first);

  const rows = await ctx.db
    .selectFrom('activities')
    .select(['id'])
    .where('avatarId', '=', avatar.id)
    .execute();

  // no duplicate activity start and no duplicate continuation row were minted by the resubmit
  expect(rows).toHaveLength(2);
});

test("it conflicts an activity start whose startChainIndex/seed is behind the chain's live anchor", async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  // a concurrent forward exit already advanced the chain past the activity start's stale head
  await ctx.db
    .updateTable('activityChains')
    .set({ appendedChainIndex: 5, appendedNextSeed: 'a'.repeat(32) })
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .execute();

  const activityID = `act_${createId()}`;

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    buildSnapshot: { level: buildLevelFromXP(0), xp: 0 },
    contentVersion: '2',
    scopeID: '0_0',
    scopeType: 'world_map_node',
    simVersion: current.engineHash,
    startChainIndex: 0,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.advanceActivity({
      activityID,
      continuations: [createMockCatchUpContinuation()],
      expectedHead: 0,
      activityStart,
    }),
  ).rejects.toMatchObject({
    code: 'CONFLICT',
    data: { activityID, appendedHead: 0 },
  });
});

test('it rejects an activity start whose buildSnapshot the server re-authors differently with CHECKPOINT_INVALID', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });
  const chain = await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const activityID = `act_${createId()}`;

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    buildSnapshot: { level: 5, xp: 9999 },
    contentVersion: '2',
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
    startChainIndex: 0,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.advanceActivity({
      activityID,
      continuations: [createMockCatchUpContinuation()],
      expectedHead: 0,
      activityStart,
    }),
  ).rejects.toMatchObject({
    code: 'CHECKPOINT_INVALID',
    data: { activityID, appendedHead: 0, reason: 'build-snapshot-mismatch' },
  });
});

test('it rejects an activity start whose startHash does not match the server recompute', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });
  const chain = await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const activityID = `act_${createId()}`;

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    buildSnapshot: { level: buildLevelFromXP(0), xp: 0 },
    contentVersion: '2',
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
    startChainIndex: 0,
    startHash: 'a'.repeat(64),
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.advanceActivity({
      activityID,
      continuations: [createMockCatchUpContinuation()],
      expectedHead: 0,
      activityStart,
    }),
  ).rejects.toMatchObject({
    code: 'CHECKPOINT_INVALID',
    data: { activityID, appendedHead: 0, reason: 'start-hash-mismatch' },
  });
});

test('it rejects an activity start whose scope has no chain row with NODE_NOT_REVEALED', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  const activityID = `act_${createId()}`;

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.advanceActivity({
      activityID,
      continuations: [createMockCatchUpContinuation()],
      expectedHead: 0,
      activityStart,
    }),
  ).rejects.toMatchObject({ code: 'NODE_NOT_REVEALED' });
});

test('it rejects an activity start at an unresolvable scope with NODE_UNKNOWN, ahead of the chain-presence check', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  const activityID = `act_${createId()}`;

  // a scope id no cell coordinate resolves, with no chain row minted for it either: the scope
  // resolves before the chain lookup, so an invalid scope classifies NODE_UNKNOWN rather than the
  // NODE_NOT_REVEALED a valid-but-unrevealed scope earns
  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    scopeID: 'not_a_real_node',
    scopeType: 'world_map_node',
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.advanceActivity({
      activityID,
      continuations: [createMockCatchUpContinuation()],
      expectedHead: 0,
      activityStart,
    }),
  ).rejects.toMatchObject({ code: 'NODE_UNKNOWN' });
});

test('it rejects an activity start submitted against a quarantined chain with CHAIN_QUARANTINED', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  await ctx.db
    .insertInto('activities')
    .values(
      createMockActivity({
        avatarId: avatar.id,
        scopeId: '0_0',
        scopeType: 'world_map_node',
        status: 'quarantined',
      }),
    )
    .execute();

  const activityID = `act_${createId()}`;

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const request = client.advanceActivity({
    activityID,
    continuations: [createMockCatchUpContinuation()],
    expectedHead: 0,
    activityStart,
  });

  await request.catch(() => {});

  expect(request).rejects.toMatchObject({
    code: 'CHAIN_QUARANTINED',
    data: { activityID, appendedHead: 0 },
  });

  // the activity start admission rolled back entirely — no row was left occupying the avatar's
  // active-run slot
  const row = await ctx.db
    .selectFrom('activities')
    .select('id')
    .where('id', '=', activityID)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it mints an activity start at a node unconnected to any completed node — reachability is a replay concern, not an admission one', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });
  const chain = await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '50_50' });

  const activityID = `act_${createId()}`;
  const document = createMockContentDocument({ contentVersion: '2' });

  const derived = deriveActivityStart({
    avatarID: avatar.id,
    avatarSeed: avatar.seed,
    contentVersion: '2',
    document,
    scopeID: '50_50',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
  });

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    buildSnapshot: { level: buildLevelFromXP(0), xp: 0 },
    contentVersion: '2',
    scopeID: '50_50',
    scopeType: 'world_map_node',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
    startChainIndex: 0,
    startHash: derived.startHash,
  });

  const tail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 40 }, type: 'completed' },
    startChainIndex: activityStart.startChainIndex,
    startPrevHash: activityStart.startHash,
    startVersion: 1,
  });

  const continuation = createMockCatchUpContinuation({
    buildSnapshot: { level: buildLevelFromXP(40), xp: 40 },
    checkpoints: tail,
    startKey: `continue_${activityID}`,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  await client.advanceActivity({
    activityID,
    continuations: [continuation],
    expectedHead: 0,
    activityStart,
  });

  const activityStartRow = await ctx.db
    .selectFrom('activities')
    .select('id')
    .where('id', '=', activityID)
    .executeTakeFirstOrThrow();

  expect(activityStartRow.id).toBe(activityID);
});

test("it rejects an activity-start admitted for an avatar that is not the account's active one", async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const activeAvatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });
  const otherAvatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActiveAvatarRow(ctx.db, { avatarId: activeAvatar.id, userId: viewer.user.id });

  const activityID = `act_${createId()}`;
  const activityStart = createMockOfflineActivityStartSubmission({ avatarID: otherAvatar.id });
  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.advanceActivity({
      activityID,
      continuations: [createMockCatchUpContinuation()],
      expectedHead: 0,
      activityStart,
    }),
  ).rejects.toMatchObject({
    code: 'AVATAR_NOT_ACTIVE',
    data: { activeAvatarID: activeAvatar.id, activeAvatarName: activeAvatar.name },
  });
});

test('it rejects an activity start whose stamped sim version is past retention with SIM_VERSION_EXPIRED', async () => {
  await using ctx = await setupTest();

  const pruned = await createSimVersionRow(ctx.db, {
    retainedUntil: new Date('2099-01-01'),
    status: 'pruned',
  });

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const activityID = `act_${createId()}`;

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    contentVersion: '2',
    scopeID: '0_0',
    scopeType: 'world_map_node',
    simVersion: pruned.engineHash,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.advanceActivity({
      activityID,
      continuations: [createMockCatchUpContinuation()],
      expectedHead: 0,
      activityStart,
    }),
  ).rejects.toMatchObject({ code: 'SIM_VERSION_EXPIRED' });
});

test('it conflicts an activity-start admission while another run is already active for the avatar', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const chain = await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '1_0' });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: '1_0', kind: 'first_clear' })
    .execute();

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  // an already-active run at a different scope occupies the avatar's single-active-run slot
  await createActivityRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const activityID = `act_${createId()}`;

  const derived = deriveActivityStart({
    avatarID: avatar.id,
    avatarSeed: avatar.seed,
    contentVersion: '2',
    document: createMockContentDocument({ contentVersion: '2' }),
    scopeID: '1_0',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
  });

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    buildSnapshot: { level: buildLevelFromXP(0), xp: 0 },
    contentVersion: '2',
    scopeID: '1_0',
    scopeType: 'world_map_node',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
    startChainIndex: 0,
    startHash: derived.startHash,
  });

  const request = client.advanceActivity({
    activityID,
    continuations: [createMockCatchUpContinuation()],
    expectedHead: 0,
    activityStart,
  });

  await request.catch(() => {});

  expect(request).rejects.toMatchObject({
    code: 'CONFLICT',
    data: { activityID, appendedHead: 0 },
  });
});

test("it rejects a caller minting an activity start on another caller's avatar with NOT_FOUND", async () => {
  await using ctx = await setupTest();

  const owner = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: owner.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const other = await createViewer({ audience: 'service-activity', db: ctx.db });

  const otherClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: other.token });
  const activityID = `act_${createId()}`;

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(
    otherClient.advanceActivity({
      activityID,
      continuations: [createMockCatchUpContinuation()],
      expectedHead: 0,
      activityStart,
    }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test("it keeps an activity start at another user's activity id owner-scoped NOT_FOUND", async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db);

  const owner = await createViewer({ audience: 'service-activity', db: ctx.db });
  const ownerAvatar = await createAvatarRow(ctx.db, { userId: owner.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: ownerAvatar.id, scopeId: '0_0' });

  const started = await createActivityRow(ctx.db, {
    avatarId: ownerAvatar.id,
    scopeId: '0_0',
  });

  const other = await createViewer({ audience: 'service-activity', db: ctx.db });
  const otherAvatar = await createAvatarRow(ctx.db, { userId: other.user.id, xp: 0 });

  await createActivityChainRow(ctx.db, { avatarId: otherAvatar.id, scopeId: '0_0' });

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: otherAvatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const otherClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: other.token });

  // the activity id belongs to owner, not to the acting caller: an owner-scoped miss stays
  // NOT_FOUND rather than reaching the mint and leaking the id's existence through CONFLICT
  expect(
    otherClient.advanceActivity({
      activityID: started.id,
      continuations: [createMockCatchUpContinuation()],
      expectedHead: 0,
      activityStart,
    }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it mints the offline successor of a just-cleared node at admission, deferring reachability to replay since the clear is unverified', async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });

  // origin node A and a neighbour B its clear opens, both revealed; the avatar holds no grant yet
  const originID = '0_0';
  const originCoord = findCellCoord(originID);

  invariant(originCoord, 'origin must resolve to a valid cell coordinate');

  const [edge] = collectNodeEdges(avatar.seed, originCoord[0], originCoord[1]);

  invariant(edge, 'every cell connects to at least one neighbour');

  const [firstID = '', secondID = ''] = edge.id.split('|');
  const neighbourID = firstID === originID ? secondID : firstID;

  const originChain = await createActivityChainRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: originID,
  });

  const neighbourChain = await createActivityChainRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: neighbourID,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  // A clears offline: its activity start anchors at the origin (always reachable), and a terminal
  // continuation delivers the clear. Admission accepts it — the origin needs no grant.
  const derivedA = deriveActivityStart({
    avatarID: avatar.id,
    avatarSeed: avatar.seed,
    contentVersion: '2',
    document: createMockContentDocument({ contentVersion: '2' }),
    scopeID: originID,
    seed: originChain.appendedNextSeed,
    simVersion: current.engineHash,
  });

  const activityStartA = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    buildSnapshot: { level: buildLevelFromXP(0), xp: 0 },
    contentVersion: '2',
    scopeID: originID,
    scopeType: 'world_map_node',
    seed: originChain.appendedNextSeed,
    simVersion: current.engineHash,
    startChainIndex: 0,
    startHash: derivedA.startHash,
  });

  const clearTail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 40 }, type: 'completed' },
    startChainIndex: 0,
    startPrevHash: derivedA.startHash,
    startVersion: 1,
  });

  await client.advanceActivity({
    activityID: `act_${createId()}`,
    continuations: [
      {
        buildSnapshot: { level: buildLevelFromXP(40), xp: 40 },
        checkpoints: clearTail,
        id: `act_${createId()}`,
        startKey: `continue_act_${createId()}`,
      },
    ],
    expectedHead: 0,
    activityStart: activityStartA,
  });

  // admission appended the clear but recorded no first-clear grant — that waits on replay, so the
  // cleared target a reachability check would read still excludes the origin
  const grant = await ctx.db
    .selectFrom('avatarGrants')
    .select('key')
    .where('avatarId', '=', avatar.id)
    .where('kind', '=', 'first_clear')
    .executeTakeFirst();

  expect(grant).toBeUndefined();

  // the clear's own continuation auto-opened a fresh attempt at A, occupying the avatar's single
  // active-run slot; the device stops it before B's activity start can mint into the freed slot
  await client.stopActivity({ avatarID: avatar.id });

  // B is the neighbour A's clear opened; its activity start mints because admission runs no
  // reachability check, only the sim-version and hash gates every activity start clears
  const derivedB = deriveActivityStart({
    avatarID: avatar.id,
    avatarSeed: avatar.seed,
    contentVersion: '2',
    document: createMockContentDocument({ contentVersion: '2' }),
    scopeID: neighbourID,
    seed: neighbourChain.appendedNextSeed,
    simVersion: current.engineHash,
  });

  const activityStartB = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    buildSnapshot: { level: buildLevelFromXP(40), xp: 40 },
    contentVersion: '2',
    scopeID: neighbourID,
    scopeType: 'world_map_node',
    seed: neighbourChain.appendedNextSeed,
    simVersion: current.engineHash,
    startChainIndex: 0,
    startHash: derivedB.startHash,
  });

  const activityID = `act_${createId()}`;

  await client.advanceActivity({
    activityID,
    continuations: [],
    expectedHead: 0,
    activityStart: activityStartB,
  });

  // the mint committed and stays unconfirmed — replay adjudicates reachability once it runs, and
  // rejects this run for the still-missing origin grant, cascading through anything built on it
  const activityStartRow = await ctx.db
    .selectFrom('activities')
    .select(['id', 'status'])
    .where('id', '=', activityID)
    .executeTakeFirstOrThrow();

  expect(activityStartRow).toMatchObject({ id: activityID, status: 'active' });
});

test("it refuses a kicked writer session's undelivered offline activityStart with the single-active-run CONFLICT, because activityStart admission carries no acting-session gate", async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);

  const viewer = await createViewer({
    audience: 'service-activity',
    db: ctx.db,
    sessionID: 'session-a',
  });

  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 0 });
  const chain = await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const clientA = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  // session A starts the avatar's live run and becomes its writer
  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  // session B takes over the same run, kicking session A off as its writer
  const keyPair = await getTestServiceKeyPair();

  const tokenB = await createServiceToken({
    actingSessionID: 'session-b',
    actingUserID: viewer.user.id,
    audience: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const clientB = buildRPCTestClient<ActivityContract>(ctx.app, { token: tokenB });

  await clientB.resumeActivity({ activityID: started.id });

  // session A, now kicked, delivers a valid offline activity start it minted before the takeover:
  // admission reads no acting-session gate, so the refusal is the generic active-run CONFLICT,
  // never a session-scoped SESSION_EVICTED
  const derived = deriveActivityStart({
    avatarID: avatar.id,
    avatarSeed: avatar.seed,
    contentVersion: '2',
    document: createMockContentDocument({ contentVersion: '2' }),
    scopeID: '0_0',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
  });

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    buildSnapshot: { level: buildLevelFromXP(0), xp: 0 },
    contentVersion: '2',
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
    startChainIndex: 0,
    startHash: derived.startHash,
  });

  expect(
    clientA.advanceActivity({
      activityID: `act_${createId()}`,
      continuations: [createMockCatchUpContinuation()],
      expectedHead: 0,
      activityStart,
    }),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
});

test("it admits a successor whose build snapshot folds the predecessor's start snapshot with its confirmed terminal checkpoint", async () => {
  await using ctx = await setupTest();

  const current = await createSimVersionRow(ctx.db);
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id, xp: 100 });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });
  const firstStart = { level: buildLevelFromXP(100), xp: 100 };

  const first = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    buildSnapshot: firstStart,
    scopeId: '0_0',
  });

  const tail = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 40 }, type: 'completed' },
    startChainIndex: first.startChainIndex,
    startPrevHash: first.startHash,
    startVersion: 1,
  });

  // the online case: every checkpoint confirmed, the terminal closed the run, nothing queued
  await client.trackActivityProgress({
    activityID: first.id,
    checkpoints: tail,
    expectedHead: 0,
  });

  const terminal = tail.at(-1);

  invariant(terminal !== undefined, 'the batch carries its terminal checkpoint');

  // the client's rule: the predecessor's own start snapshot plus its terminal checkpoint, folded
  // through the shared fold with no outbox in sight
  const predicted = foldOptimisticBuild(firstStart.xp, [
    { settledXP: 0, tailPayload: terminal.payload, unverifiedDeltaSum: 0 },
  ]);

  const chain = await ctx.db
    .selectFrom('activityChains')
    .select(['appendedNextSeed', 'appendedChainIndex'])
    .where('avatarId', '=', avatar.id)
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  const derived = deriveActivityStart({
    avatarID: avatar.id,
    avatarSeed: avatar.seed,
    contentVersion: '2',
    document: createMockContentDocument({ contentVersion: '2' }),
    scopeID: '0_0',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
  });

  const activityStart = createMockOfflineActivityStartSubmission({
    avatarID: avatar.id,
    buildSnapshot: { level: buildLevelFromXP(predicted.totalXP), xp: predicted.totalXP },
    contentVersion: '2',
    predecessorActivityID: first.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: chain.appendedNextSeed,
    simVersion: current.engineHash,
    startChainIndex: chain.appendedChainIndex,
    startHash: derived.startHash,
  });

  const activityID = `act_${createId()}`;

  await client.advanceActivity({ activityID, continuations: [], expectedHead: 0, activityStart });

  const row = await ctx.db
    .selectFrom('activities')
    .select('buildSnapshot')
    .where('id', '=', activityID)
    .executeTakeFirstOrThrow();

  expect(row.buildSnapshot).toStrictEqual({ level: buildLevelFromXP(140), xp: 140 });
});
