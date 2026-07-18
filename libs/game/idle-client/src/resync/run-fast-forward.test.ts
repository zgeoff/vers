import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ActivityData, CheckpointBatchEntry } from '@vers/contract-activity';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityFailureAction, runAttempt } from '@vers/idle-core';
import {
  createMockActivityInput,
  createMockAvatarData,
  createMockEnemyData,
} from '@vers/idle-core/test-utils';
import { resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import { createCheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import { runFastForward } from './run-fast-forward';
import type { FastForwardProgress, LatestActivityProgress } from './types';

interface TrackedBatch {
  readonly checkpoints: ReadonlyArray<CheckpointBatchEntry>;
  readonly expectedHead: number;
}

function setupTest() {
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

  return { batches, client, startedActivities, submitter };
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
    budgetMs: 3000,
    buildSimulationInput: (activity) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
        failureAction: ActivityFailureAction.Retry,
        id: activity.id,
        seed: activity.seed,
      }),
      avatar: createMockAvatarData(),
    }),
    client: ctx.client,
    progress,
    submitter: ctx.submitter,
  });

  expect(report).toStrictEqual({
    activity: progress.activity,
    appendedHead: 0,
    attempts: 0,
    finalRowTerminal: false,
    levelUps: 0,
    reason: 'budget-exhausted',
  });

  expect(ctx.batches).toStrictEqual([]);
});

test('it reports the final row terminal when a reconstructed tail lands exactly on the budget', async () => {
  const ctx = setupTest();

  const progress: LatestActivityProgress = {
    activity: createMockActivityData(),
    anchor: null,
    appendedHead: 1,
    serverTime: new Date(),
    verifiedHead: 0,
  };

  // One fixed input template, deep-copied per call: the probe attempt below and the
  // fast-forward's reconstruction must simulate byte-identically for the budget to land exactly.
  const template = {
    activity: createMockActivityInput({
      encounter: {
        waves: [
          Array.from({ length: 6 }, () => createMockEnemyData()),
          Array.from({ length: 6 }, () => createMockEnemyData()),
          Array.from({ length: 3 }, () => createMockEnemyData()),
          Array.from({ length: 4 }, () => createMockEnemyData()),
        ],
      },
      failureAction: ActivityFailureAction.Retry,
      id: progress.activity.id,
      seed: progress.activity.seed,
    }),
    avatar: createMockAvatarData(),
  };

  const probeInput = structuredClone(template);

  const probe = await runAttempt(probeInput.activity, probeInput.avatar, {
    maxDurationMs: Number.MAX_SAFE_INTEGER,
  });

  // The unaccounted tail past the appended head prices the attempt; a budget equal to it is
  // consumed exactly, ending the fast-forward on a submitted terminal with no continuation.
  const tailTimeMs = (probe.checkpoints.at(-1)?.time ?? 0) - (probe.checkpoints[0]?.time ?? 0);

  const report = await runFastForward({
    budgetMs: tailTimeMs,
    buildSimulationInput: () => structuredClone(template),
    client: ctx.client,
    progress,
    submitter: ctx.submitter,
  });

  expect(report).toMatchObject({
    attempts: 1,
    finalRowTerminal: true,
    reason: 'budget-exhausted',
  });

  expect(ctx.batches).toHaveLength(1);
  expect(ctx.startedActivities).toStrictEqual([]);
});

test('it stops after the first failed attempt under the abort policy', async () => {
  const ctx = setupTest();
  const onProgress = mock<(progress: FastForwardProgress) => void>();

  const progress: LatestActivityProgress = {
    activity: createMockActivityData(),
    anchor: null,
    appendedHead: 0,
    serverTime: new Date(),
    verifiedHead: 0,
  };

  const report = await runFastForward({
    budgetMs: 60_000,
    buildSimulationInput: (activity) => ({
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
        id: activity.id,
        seed: activity.seed,
      }),

      // life 1 dies on the first hit taken, so the attempt fails quickly
      avatar: createMockAvatarData({ life: 1 }),
    }),
    client: ctx.client,
    onProgress,
    progress,
    submitter: ctx.submitter,
  });

  expect(report).toMatchObject({
    attempts: 1,
    finalRowTerminal: true,
    reason: 'aborted-on-failure',
  });

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
    budgetMs: 30_000,
    buildSimulationInput: (activity) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
        failureAction: ActivityFailureAction.Retry,
        id: activity.id,
        seed: activity.seed,
      }),
      avatar: createMockAvatarData({ life: 1 }),
    }),
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
  const ctx = setupTest();

  const progress: LatestActivityProgress = {
    activity: createMockActivityData({ appendedHead: 1 }),
    anchor: null,
    appendedHead: 1,
    serverTime: new Date(),
    verifiedHead: 0,
  };

  const report = await runFastForward({
    budgetMs: 60_000,
    buildSimulationInput: (activity) => ({
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
        id: activity.id,
        seed: activity.seed,
      }),
      avatar: createMockAvatarData({ life: 1 }),
    }),
    client: ctx.client,
    progress,
    submitter: ctx.submitter,
  });

  expect(report.attempts).toBe(1);
  expect(ctx.batches).toHaveLength(1);
  expect(ctx.batches[0]?.expectedHead).toBe(1);
  expect(ctx.batches[0]?.checkpoints[0]?.version).toBe(2);
});

test('it reports the final row it left off at, for a caller to attach directly', async () => {
  const ctx = setupTest();

  const progress: LatestActivityProgress = {
    activity: createMockActivityData(),
    anchor: null,
    appendedHead: 0,
    serverTime: new Date(),
    verifiedHead: 0,
  };

  const report = await runFastForward({
    budgetMs: 30_000,
    buildSimulationInput: (activity) => ({
      activity: createMockActivityInput({
        encounter: {
          waves: [
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 6 }, () => createMockEnemyData()),
            Array.from({ length: 3 }, () => createMockEnemyData()),
            Array.from({ length: 4 }, () => createMockEnemyData()),
          ],
        },
        failureAction: ActivityFailureAction.Retry,
        id: activity.id,
        seed: activity.seed,
      }),
      avatar: createMockAvatarData({ life: 1 }),
    }),
    client: ctx.client,
    progress,
    submitter: ctx.submitter,
  });

  const lastStarted = ctx.startedActivities.at(-1);

  invariant(lastStarted !== undefined, 'expected at least one server-started continuation');
  expect(report.activity).toStrictEqual(lastStarted);
  expect(report.appendedHead).toBe(0);
});
