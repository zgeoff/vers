import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { ActivityFailureAction } from '@vers/idle-core';
import {
  createMockActivityInput,
  createMockAvatarData,
  createMockEnemyData,
} from '@vers/idle-core/test-utils';
import { createTestAccessToken, resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { server } from '../mocks/node';
import { createCheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import type { ActivityServiceClient } from '../submission/types';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { createMockProgressCheckpoint } from '../test-utils/factories/create-mock-progress-checkpoint';
import { runResync } from './run-resync';

interface SetupTestConfig {
  readonly scheduleRetry?: (delayMs: number, retry: () => Promise<void>) => void;
  readonly userID: string;
}

/**
 * Builds an authed client acting as the given user, so the
 * resync's fetch, drain, and append calls hit the same state transitions the real service applies
 * to the rows the test seeds in the mock db.
 */
async function setupTest(config: Readonly<SetupTestConfig>) {
  const token = await createTestAccessToken(config.userID);

  const client: ActivityServiceClient = createORPCClient(
    new RPCLink({
      headers: { authorization: `Bearer ${token}` },
      url: `${resolveServiceURL('activity')}/rpc`,
    }),
  );

  const onInvalid = mock<(activityID: string, reason: string) => void>();

  const submitter = createCheckpointSubmitter({
    client,
    onInvalid,
    ...(config.scheduleRetry === undefined ? {} : { scheduleRetry: config.scheduleRetry }),
  });

  return { client, submitter };
}

test('it resolves to none for an avatar with no activity history', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const result = await runResync({
    avatarID: avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        enemies: [createMockEnemyData()],
        failureAction: ActivityFailureAction.Abort,
        id: started.id,
        seed: started.seed,
      }),
      avatar: createMockAvatarData(),
    }),
    client: ctx.client,
    submitter: ctx.submitter,
  });

  expect(result).toStrictEqual({ plan: { kind: 'none' }, progress: null });
});

test('it rebases from the stop index without simulating when the activity is capped', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const activity = await db.activityCollection.create({
    appendedHead: 5,
    avatarID: avatar.id,
    status: 'capped',
    verifiedHead: 3,
  });

  const result = await runResync({
    avatarID: avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        enemies: [createMockEnemyData()],
        failureAction: ActivityFailureAction.Abort,
        id: started.id,
        seed: started.seed,
      }),
      avatar: createMockAvatarData(),
    }),
    client: ctx.client,
    submitter: ctx.submitter,
  });

  expect(result.report).toBeUndefined();

  expect(result.plan).toStrictEqual({
    context: {
      activityID: activity.id,
      appendedHead: 5,
      lastHash: activity.lastHash,
      startChainIndex: activity.startChainIndex,
    },
    kind: 'rebase',
  });
});

test('it attaches live when the gap is negligible, leaving the submitter untouched', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 2000),
    appendedHead: 0,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  const result = await runResync({
    avatarID: avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        enemies: [createMockEnemyData()],
        failureAction: ActivityFailureAction.Abort,
        id: started.id,
        seed: started.seed,
      }),
      avatar: createMockAvatarData(),
    }),
    client: ctx.client,
    submitter: ctx.submitter,
  });

  expect(result.plan.kind).toBe('attach-live');
  expect(result.report).toBeUndefined();
  expect(result.progress?.activity).toStrictEqual(activity);

  // the submitter was never registered for this activity, so a checkpoint for it is dropped
  await ctx.submitter.submit(activity.id, createMockProgressCheckpoint());

  const queued = await readQueuedCheckpoints(activity.id);

  expect(queued).toStrictEqual([]);
});

test('it fast-forwards a real offline gap and reports the outcome', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 60_000),
    appendedHead: 0,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  const result = await runResync({
    avatarID: avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        enemies: [createMockEnemyData()],
        failureAction: ActivityFailureAction.Abort,
        id: started.id,
        seed: started.seed,
      }),

      // life 1 fails the first attempt fast, and the abort policy ends the fast-forward there
      avatar: createMockAvatarData({ life: 1 }),
    }),
    client: ctx.client,
    submitter: ctx.submitter,
  });

  expect(result.plan).toMatchObject({
    budgetMs: expect.toBeWithin(60_000, 61_000),
    kind: 'fast-forward',
  });

  expect(result.report).toMatchObject({ attempts: 1, reason: 'aborted-on-failure' });
});

test('it delivers checkpoints a previous worker left queued and plans against the head they advanced', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 60_000),
    appendedHead: 5,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  await writeQueuedCheckpoint(
    activity.id,
    createMockCheckpointBatchEntry({ hash: 'stranded_hash_6', version: 6 }),
  );

  await writeQueuedCheckpoint(
    activity.id,
    createMockCheckpointBatchEntry({ hash: 'stranded_hash_7', version: 7 }),
  );

  const result = await runResync({
    avatarID: avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        enemies: [createMockEnemyData()],
        failureAction: ActivityFailureAction.Abort,
        id: started.id,
        seed: started.seed,
      }),
      avatar: createMockAvatarData(),
    }),
    client: ctx.client,
    submitter: ctx.submitter,
  });

  // the stranded rows landed as one append onto the seeded head, freshening the row — so the
  // refetched gap is gone and the plan attaches live at the head they advanced
  const landed = db.checkpointCollection.findMany((q) => q.where({ activityID: activity.id }));

  expect(landed.map((row) => row.version)).toStrictEqual([6, 7]);
  expect(result.plan).toMatchObject({ context: { appendedHead: 7 }, kind: 'attach-live' });

  const remaining = await readQueuedCheckpoints(activity.id);

  expect(remaining).toStrictEqual([]);
});

test('it refuses to plan while stranded checkpoints cannot be delivered', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ scheduleRetry: () => {}, userID: user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 60_000),
    appendedHead: 5,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  await writeQueuedCheckpoint(
    activity.id,
    createMockCheckpointBatchEntry({ hash: 'stranded_hash_6', version: 6 }),
  );

  server.use(
    mockActivityService.trackActivityProgress.handler(() => {
      throw new Error('unreachable service');
    }),
  );

  expect(
    runResync({
      avatarID: avatar.id,
      buildSimulationInput: (started) => ({
        activity: createMockActivityInput({
          enemies: [createMockEnemyData()],
          failureAction: ActivityFailureAction.Abort,
          id: started.id,
          seed: started.seed,
        }),
        avatar: createMockAvatarData(),
      }),
      client: ctx.client,
      submitter: ctx.submitter,
    }),
  ).rejects.toThrow('queued checkpoints could not be delivered');
});

test('it downgrades a fast-forward to attach-live when the activity is already simulating live', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 60_000),
    appendedHead: 3,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  const result = await runResync({
    avatarID: avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        enemies: [createMockEnemyData()],
        failureAction: ActivityFailureAction.Abort,
        id: started.id,
        seed: started.seed,
      }),
      avatar: createMockAvatarData(),
    }),
    client: ctx.client,
    isActivityLive: (activityID) => activityID === activity.id,
    submitter: ctx.submitter,
  });

  expect(result.plan).toMatchObject({ context: { appendedHead: 3 }, kind: 'attach-live' });
  expect(result.report).toBeUndefined();
});

test('it leaves a live activity queue untouched instead of draining it', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 2000),
    appendedHead: 5,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  // a checkpoint the live writer queued during the fetch round trip — pipeline, not stranded work
  await writeQueuedCheckpoint(
    activity.id,
    createMockCheckpointBatchEntry({ hash: 'in_flight_hash_6', version: 6 }),
  );

  const result = await runResync({
    avatarID: avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        enemies: [createMockEnemyData()],
        failureAction: ActivityFailureAction.Abort,
        id: started.id,
        seed: started.seed,
      }),
      avatar: createMockAvatarData(),
    }),
    client: ctx.client,
    isActivityLive: (activityID) => activityID === activity.id,
    submitter: ctx.submitter,
  });

  expect(result.plan.kind).toBe('attach-live');

  const stillQueued = await readQueuedCheckpoints(activity.id);

  expect(stillQueued).toHaveLength(1);
});
