import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ActivityData, CheckpointBatchEntry } from '@vers/contract-activity';
import {
  ActivityFailureAction,
  createMockActivityInput,
  createMockAvatarData,
  createMockEnemyData,
} from '@vers/idle-core';
import { resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import { server } from '../mocks/node';
import { createCheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import { createMockActivityData } from '../test-utils/factories/create-mock-activity-data';
import { runFastForward } from './run-fast-forward';
import type { FastForwardProgress, LatestActivityProgress } from './types';

interface TrackedBatch {
  readonly checkpoints: ReadonlyArray<CheckpointBatchEntry>;
  readonly expectedHead: number;
}

function setupTest(config: { readonly failureAction?: ActivityFailureAction } = {}) {
  const link = new RPCLink({ url: `${resolveServiceURL('activity')}/rpc` });

  const client: ActivityServiceClient = createORPCClient(link);
  const batches: Array<TrackedBatch> = [];
  const startedActivities: Array<ActivityData> = [];

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      batches.push({
        checkpoints: opts.input.checkpoints,
        expectedHead: opts.input.expectedHead,
      });

      const last = opts.input.checkpoints.at(-1);

      return { appendedHead: last?.version ?? opts.input.expectedHead };
    }),
    mockActivityService.startActivity.handler((opts) => {
      const started = createMockActivityData({ avatarID: opts.input.avatarID });

      startedActivities.push(started);

      return started;
    }),
  );

  const onInvalid = mock<(activityID: string, reason: string) => void>();
  const submitter = createCheckpointSubmitter({ client, onInvalid });

  const buildActivityInput = (activity: ActivityData) =>
    createMockActivityInput({
      enemies: [createMockEnemyData()],
      failureAction: config.failureAction ?? ActivityFailureAction.Retry,
      id: activity.id,
      seed: activity.seed,
    });

  return { batches, buildActivityInput, client, startedActivities, submitter };
}

test('it discards a partial attempt and submits nothing when the budget is too small', async () => {
  const ctx = setupTest();

  const progress: LatestActivityProgress = {
    activity: createMockActivityData(),
    anchor: null,
    appendedHead: 0,
    serverTime: new Date(),
    verifiedHead: 0,
  };

  const report = await runFastForward({
    avatar: createMockAvatarData(),
    budgetMs: 3000,
    buildActivityInput: ctx.buildActivityInput,
    client: ctx.client,
    progress,
    submitter: ctx.submitter,
  });

  expect(report).toStrictEqual({ attempts: 0, levelUps: 0, reason: 'budget-exhausted' });
  expect(ctx.batches).toStrictEqual([]);
});

test('it stops after the first failed attempt under the abort policy', async () => {
  const ctx = setupTest({ failureAction: ActivityFailureAction.Abort });
  const onProgress = mock<(progress: FastForwardProgress) => void>();

  const progress: LatestActivityProgress = {
    activity: createMockActivityData(),
    anchor: null,
    appendedHead: 0,
    serverTime: new Date(),
    verifiedHead: 0,
  };

  const report = await runFastForward({
    // life 1 dies on the first hit taken, so the attempt fails quickly
    avatar: createMockAvatarData({ life: 1 }),
    budgetMs: 60_000,
    buildActivityInput: ctx.buildActivityInput,
    client: ctx.client,
    onProgress,
    progress,
    submitter: ctx.submitter,
  });

  expect(report).toMatchObject({ attempts: 1, reason: 'aborted-on-failure' });
  expect(onProgress).toHaveBeenCalledExactlyOnceWith({ attempts: 1, levelUps: 0 });
  expect(ctx.batches).toHaveLength(1);
  expect(ctx.batches[0]?.checkpoints.at(-1)?.payload.type).toBe('failed');
  expect(ctx.startedActivities).toStrictEqual([]);
});

test('it chains fresh server-started attempts through failures under the retry policy', async () => {
  const ctx = setupTest();

  const progress: LatestActivityProgress = {
    activity: createMockActivityData(),
    anchor: null,
    appendedHead: 0,
    serverTime: new Date(),
    verifiedHead: 0,
  };

  const report = await runFastForward({
    avatar: createMockAvatarData({ life: 1 }),
    budgetMs: 30_000,
    buildActivityInput: ctx.buildActivityInput,
    client: ctx.client,
    progress,
    submitter: ctx.submitter,
  });

  expect(report.reason).toBe('budget-exhausted');
  expect(report.attempts).toBeGreaterThan(1);
  expect(ctx.startedActivities.length).toBeGreaterThanOrEqual(report.attempts - 1);

  // every submitted stream ends on a terminal checkpoint — never mid-encounter
  for (const batch of ctx.batches) {
    expect(batch.checkpoints.at(-1)?.payload.type).toBe('failed');
  }
});

test('it resumes a mid-stream activity submitting only the tail past the appended head', async () => {
  const ctx = setupTest({ failureAction: ActivityFailureAction.Abort });

  const progress: LatestActivityProgress = {
    activity: createMockActivityData({ appendedHead: 1 }),
    anchor: null,
    appendedHead: 1,
    serverTime: new Date(),
    verifiedHead: 0,
  };

  const report = await runFastForward({
    avatar: createMockAvatarData({ life: 1 }),
    budgetMs: 60_000,
    buildActivityInput: ctx.buildActivityInput,
    client: ctx.client,
    progress,
    submitter: ctx.submitter,
  });

  expect(report.attempts).toBe(1);
  expect(ctx.batches).toHaveLength(1);
  expect(ctx.batches[0]?.expectedHead).toBe(1);
  expect(ctx.batches[0]?.checkpoints[0]?.version).toBe(2);
});
