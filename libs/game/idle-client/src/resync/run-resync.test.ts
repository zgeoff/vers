import { expect, mock, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import {
  createMockActivityInput,
  createMockAvatarData,
  createMockEnemyData,
} from '@vers/idle-core/test-utils';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { waitFor } from '@vers/test-utils';
import { server } from '../mocks/node';
import { createCheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import type { ActivityServiceClient } from '../submission/types';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { createMockProgressCheckpoint } from '../test-utils/factories/create-mock-progress-checkpoint';
import { runResync } from './run-resync';
import type { LatestActivityProgress } from './types';

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
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', config.userID);

  const onInvalid = mock<(activityID: string, reason: string) => void>();

  const submitter = createCheckpointSubmitter({
    client,
    onInvalid,
    ...(config.scheduleRetry === undefined ? {} : { scheduleRetry: config.scheduleRetry }),
  });

  return { client, submitter };
}

test('it resolves to none for an avatar with no activity history', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const result = await runResync({
    avatarID: viewer.avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
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
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const activity = await db.activityCollection.create({
    appendedHead: 5,
    avatarID: viewer.avatar.id,
    status: 'capped',
    verifiedHead: 3,
  });

  const result = await runResync({
    avatarID: viewer.avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
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
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 2000),
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  const result = await runResync({
    avatarID: viewer.avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
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
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 60_000),
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  const result = await runResync({
    avatarID: viewer.avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
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

test('it awaits onProgressFetched with the settled progress before planning a fast-forward', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 60_000),
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  // a promise the test controls: while it stays pending, a dropped await on the reconcile would let
  // the fast-forward's progress fire before the reconcile settled
  const reconcileGate = Promise.withResolvers<void>();
  const onProgress = mock(() => {});

  const onProgressFetched = mock((progress: LatestActivityProgress) => {
    expect(progress.activity.id).toBe(activity.id);

    return reconcileGate.promise;
  });

  const resync = runResync({
    avatarID: viewer.avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
        failureAction: ActivityFailureAction.Abort,
        id: started.id,
        seed: started.seed,
      }),

      // life 1 fails the first attempt fast, and the abort policy ends the fast-forward there
      avatar: createMockAvatarData({ life: 1 }),
    }),
    client: ctx.client,
    onProgress,
    onProgressFetched,
    submitter: ctx.submitter,
  });

  await waitFor(() => {
    expect(onProgressFetched).toHaveBeenCalledOnce();
  });

  expect(onProgress).not.toHaveBeenCalled();

  reconcileGate.resolve();

  await resync;

  expect(onProgress).toHaveBeenCalled();
});

test('it delivers checkpoints a previous worker left queued and plans against the head they advanced', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 60_000),
    appendedHead: 5,
    avatarID: viewer.avatar.id,
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
    avatarID: viewer.avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
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
  const viewer = await createViewer();
  const ctx = await setupTest({ scheduleRetry: () => {}, userID: viewer.user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 60_000),
    appendedHead: 5,
    avatarID: viewer.avatar.id,
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
      avatarID: viewer.avatar.id,
      buildSimulationInput: (started) => ({
        activity: createMockActivityInput({
          encounter: {
            waves: [
              Array.from({ length: 6 }, () => createMockEnemyData()),
              Array.from({ length: 6 }, () => createMockEnemyData()),
              Array.from({ length: 3 }, () => createMockEnemyData()),
              Array.from({ length: 4 }, () => createMockEnemyData()),
            ],
          },
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
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 60_000),
    appendedHead: 3,
    avatarID: viewer.avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  const result = await runResync({
    avatarID: viewer.avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
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
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 2000),
    appendedHead: 5,
    avatarID: viewer.avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  // a checkpoint the live writer queued during the fetch round trip — pipeline, not stranded work
  await writeQueuedCheckpoint(
    activity.id,
    createMockCheckpointBatchEntry({ hash: 'in_flight_hash_6', version: 6 }),
  );

  const result = await runResync({
    avatarID: viewer.avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
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

test('it resolves active-elsewhere without claiming when another session holds the writer', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 2000),
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  const resume = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.getLatestActivityProgress.handler(() => ({
      activity,
      anchor: null,
      appendedHead: 0,
      failureAction: 'abort' as const,
      isWriter: false,
      serverTime: new Date(),
      verifiedHead: 0,
    })),
    mockActivityService.resumeActivity.handler((opts) => {
      resume(opts.input);

      return activity;
    }),
  );

  const result = await runResync({
    avatarID: viewer.avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
        failureAction: ActivityFailureAction.Abort,
        id: started.id,
        seed: started.seed,
      }),
      avatar: createMockAvatarData(),
    }),
    client: ctx.client,
    submitter: ctx.submitter,
  });

  expect(result.plan).toStrictEqual({ activityID: activity.id, kind: 'active-elsewhere' });
  expect(result.report).toBeUndefined();
  expect(resume).not.toHaveBeenCalled();
});

test('it takes over the writer before planning when claiming a run another session holds', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 2000),
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  const resume = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.getLatestActivityProgress.handler(() => ({
      activity,
      anchor: null,
      appendedHead: 0,
      failureAction: 'abort' as const,
      isWriter: false,
      serverTime: new Date(),
      verifiedHead: 0,
    })),
    mockActivityService.resumeActivity.handler((opts) => {
      resume(opts.input);

      return activity;
    }),
  );

  const result = await runResync({
    avatarID: viewer.avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
        failureAction: ActivityFailureAction.Abort,
        id: started.id,
        seed: started.seed,
      }),
      avatar: createMockAvatarData(),
    }),
    claimWriter: true,
    client: ctx.client,
    submitter: ctx.submitter,
  });

  expect(result.plan.kind).toBe('attach-live');
  expect(resume).toHaveBeenCalledExactlyOnceWith({ activityID: activity.id });
});

test('it skips the claim when this session already holds the writer', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 2000),
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  const resume = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.resumeActivity.handler((opts) => {
      resume(opts.input);

      return activity;
    }),
  );

  const result = await runResync({
    avatarID: viewer.avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
        failureAction: ActivityFailureAction.Abort,
        id: started.id,
        seed: started.seed,
      }),
      avatar: createMockAvatarData(),
    }),
    claimWriter: true,
    client: ctx.client,
    submitter: ctx.submitter,
  });

  expect(result.plan.kind).toBe('attach-live');
  expect(resume).not.toHaveBeenCalled();
});

test('it refetches after a claim that reveals appends the fetch missed', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 2000),
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  let fetches = 0;

  server.use(
    mockActivityService.getLatestActivityProgress.handler(() => {
      fetches += 1;

      // the displaced writer lands one more batch between the first fetch and the claim
      const appendedHead = fetches === 1 ? 0 : 2;

      return {
        activity: { ...activity, appendedHead },
        anchor: null,
        appendedHead,
        failureAction: 'abort' as const,
        isWriter: fetches > 1,
        serverTime: new Date(),
        verifiedHead: 0,
      };
    }),
    mockActivityService.resumeActivity.handler(() => ({ ...activity, appendedHead: 2 })),
  );

  const result = await runResync({
    avatarID: viewer.avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
        failureAction: ActivityFailureAction.Abort,
        id: started.id,
        seed: started.seed,
      }),
      avatar: createMockAvatarData(),
    }),
    claimWriter: true,
    client: ctx.client,
    submitter: ctx.submitter,
  });

  expect(fetches).toBe(2);
  expect(result.plan).toMatchObject({ context: { appendedHead: 2 }, kind: 'attach-live' });
});

test('it plans the terminal outcome without claiming when the run ends before the claim lands', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const activity = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 2000),
    appendedHead: 4,
    avatarID: viewer.avatar.id,
    status: 'active',
    verifiedHead: 0,
  });

  let fetches = 0;

  server.use(
    mockActivityService.getLatestActivityProgress.handler(() => {
      fetches += 1;

      // the other session stops the run between the first fetch and the claim
      const status = fetches === 1 ? ('active' as const) : ('stopped' as const);

      return {
        activity: { ...activity, status },
        anchor: null,
        appendedHead: 4,
        failureAction: 'abort' as const,
        isWriter: false,
        serverTime: new Date(),
        verifiedHead: 0,
      };
    }),
    mockActivityService.resumeActivity.handler((opts) => {
      throw opts.errors.NOT_FOUND({ data: {} });
    }),
  );

  const result = await runResync({
    avatarID: viewer.avatar.id,
    buildSimulationInput: (started) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
        failureAction: ActivityFailureAction.Abort,
        id: started.id,
        seed: started.seed,
      }),
      avatar: createMockAvatarData(),
    }),
    claimWriter: true,
    client: ctx.client,
    submitter: ctx.submitter,
  });

  expect(fetches).toBe(2);
  expect(result.plan).toStrictEqual({ kind: 'none' });
});
