import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ActivityData, CatchUpContinuation } from '@vers/contract-activity';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityFailureAction, runAttempt } from '@vers/idle-core';
import {
  createMockActivityInput,
  createMockAvatarData,
  createMockEnemyData,
} from '@vers/idle-core/test-utils';
import { resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import { HttpResponse } from 'msw';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import type { ActivityServiceClient } from '../submission/types';
import { createMockLatestActivityProgress } from '../test-utils/factories/create-mock-latest-activity-progress';
import { runFastForward } from './run-fast-forward';
import type { FastForwardProgress } from './types';

interface TrackedAdvanceCall {
  readonly activityID: string;
  readonly continuations: ReadonlyArray<CatchUpContinuation>;
  readonly expectedHead: number;
}

function buildWaveTemplate() {
  return {
    waves: [
      Array.from({ length: 6 }, () => createMockEnemyData()),
      Array.from({ length: 6 }, () => createMockEnemyData()),
      Array.from({ length: 3 }, () => createMockEnemyData()),
      Array.from({ length: 4 }, () => createMockEnemyData()),
    ],
  };
}

function setupTest() {
  const link = new RPCLink({ url: `${resolveServiceURL('activity')}/rpc` });

  const client: ActivityServiceClient = createORPCClient(link);
  const calls: Array<TrackedAdvanceCall> = [];

  const handlers = [
    mockActivityService.advanceActivity.handler((opts) => {
      calls.push({
        activityID: opts.input.activityID,
        continuations: opts.input.continuations,
        expectedHead: opts.input.expectedHead,
      });

      const lastContinuation = opts.input.continuations.at(-1);

      invariant(lastContinuation !== undefined, 'a bulk request always carries a continuation');

      const activity: ActivityData = createMockActivityData({
        id: lastContinuation.id,
        startKey: lastContinuation.startKey,
      });

      return { activity, appendedHead: 0 };
    }),
  ];

  server.use(...handlers);

  return { calls, client };
}

test('it discards a partial attempt and submits nothing when the budget is too small', async () => {
  const ctx = setupTest();
  const progress = createMockLatestActivityProgress();

  const report = await runFastForward({
    budgetMs: 3000,
    buildSimulationInput: (source) =>
      Promise.resolve({
        activity: createMockActivityInput({
          encounter: buildWaveTemplate(),
          failureAction: ActivityFailureAction.Retry,
          id: source.id,
          seed: source.seed,
        }),
        avatar: createMockAvatarData(),
      }),
    client: ctx.client,
    progress,
  });

  expect(report).toStrictEqual({
    activity: progress.activity,
    appendedHead: 0,
    attempts: 0,
    finalRowTerminal: false,
    levelUps: 0,
    reason: 'budget-exhausted',
  });

  expect(ctx.calls).toStrictEqual([]);
});

test('it consumes exactly the budget when a reconstructed tail lands on it precisely', async () => {
  const ctx = setupTest();

  const progress = createMockLatestActivityProgress({
    activity: createMockActivityData({ appendedHead: 1 }),
    appendedHead: 1,
  });

  // One fixed input template, deep-copied per call: the probe attempt below and the
  // fast-forward's reconstruction must simulate byte-identically for the budget to land exactly.
  const template = {
    activity: createMockActivityInput({
      encounter: buildWaveTemplate(),
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
  // consumed exactly.
  const tailTimeMs = (probe.checkpoints.at(-1)?.time ?? 0) - (probe.checkpoints[0]?.time ?? 0);

  const report = await runFastForward({
    budgetMs: tailTimeMs,
    buildSimulationInput: () => Promise.resolve(structuredClone(template)),
    client: ctx.client,
    progress,
  });

  expect(report).toMatchObject({
    attempts: 1,
    finalRowTerminal: false,
    reason: 'budget-exhausted',
  });

  expect(ctx.calls).toHaveLength(1);
  expect(ctx.calls[0]?.expectedHead).toBe(1);
  expect(ctx.calls[0]?.continuations).toHaveLength(1);
});

test('it stops after the first failed attempt under the abort policy', async () => {
  const ctx = setupTest();
  const onProgress = mock<(progress: FastForwardProgress) => void>();
  const progress = createMockLatestActivityProgress();

  const report = await runFastForward({
    budgetMs: 60_000,
    buildSimulationInput: (source) =>
      Promise.resolve({
        activity: createMockActivityInput({
          encounter: buildWaveTemplate(),
          failureAction: ActivityFailureAction.Abort,
          id: source.id,
          seed: source.seed,
        }),

        // life 1 dies on the first hit taken, so the attempt fails quickly
        avatar: createMockAvatarData({ life: 1 }),
      }),
    client: ctx.client,
    onProgress,
    progress,
  });

  expect(report).toMatchObject({
    attempts: 1,
    finalRowTerminal: true,
    reason: 'aborted-on-failure',
  });

  expect(onProgress).toHaveBeenCalledExactlyOnceWith({ attempts: 1, levelUps: 0 });
  expect(ctx.calls).toHaveLength(1);
  expect(ctx.calls[0]?.continuations[0]?.checkpoints.at(-1)?.payload.type).toBe('failed');
});

test('it plans multiple continuations locally and ships them in one bulk request', async () => {
  const ctx = setupTest();
  const progress = createMockLatestActivityProgress();

  const report = await runFastForward({
    budgetMs: 30_000,
    buildSimulationInput: (source) =>
      Promise.resolve({
        activity: createMockActivityInput({
          encounter: buildWaveTemplate(),
          failureAction: ActivityFailureAction.Retry,
          id: source.id,
          seed: source.seed,
        }),
        avatar: createMockAvatarData({ life: 1 }),
      }),
    client: ctx.client,
    progress,
  });

  expect(report.reason).toBe('budget-exhausted');
  expect(report.attempts).toBeGreaterThan(1);

  // the whole plan ships as one bulk request, never one call per continuation
  expect(ctx.calls).toHaveLength(1);
  expect(ctx.calls[0]?.continuations.length).toBe(report.attempts);

  for (const continuation of ctx.calls[0]?.continuations ?? []) {
    expect(continuation.checkpoints.at(-1)?.payload.type).toBe('failed');
  }
});

test('it resumes a mid-stream activity submitting only the tail past the appended head', async () => {
  const ctx = setupTest();

  const progress = createMockLatestActivityProgress({
    activity: createMockActivityData({ appendedHead: 1 }),
    appendedHead: 1,
  });

  const report = await runFastForward({
    budgetMs: 60_000,
    buildSimulationInput: (source) =>
      Promise.resolve({
        activity: createMockActivityInput({
          encounter: buildWaveTemplate(),
          failureAction: ActivityFailureAction.Abort,
          id: source.id,
          seed: source.seed,
        }),
        avatar: createMockAvatarData({ life: 1 }),
      }),
    client: ctx.client,
    progress,
  });

  expect(report.attempts).toBe(1);
  expect(ctx.calls).toHaveLength(1);
  expect(ctx.calls[0]?.expectedHead).toBe(1);
  expect(ctx.calls[0]?.continuations[0]?.checkpoints[0]?.version).toBe(2);
});

test('it reports the final row the server minted, for a caller to attach directly', async () => {
  const ctx = setupTest();
  const progress = createMockLatestActivityProgress();

  const report = await runFastForward({
    budgetMs: 30_000,
    buildSimulationInput: (source) =>
      Promise.resolve({
        activity: createMockActivityInput({
          encounter: buildWaveTemplate(),
          failureAction: ActivityFailureAction.Retry,
          id: source.id,
          seed: source.seed,
        }),
        avatar: createMockAvatarData({ life: 1 }),
      }),
    client: ctx.client,
    progress,
  });

  expect(report.activity.id).toBe(ctx.calls[0]!.continuations.at(-1)!.id);
  expect(report.appendedHead).toBe(0);
});

test('it splits a large plan into bounded batches, awaiting each in order', async () => {
  const ctx = setupTest();
  const progress = createMockLatestActivityProgress();

  const report = await runFastForward({
    budgetMs: 60_000,
    buildSimulationInput: (source) =>
      Promise.resolve({
        activity: createMockActivityInput({
          encounter: buildWaveTemplate(),
          failureAction: ActivityFailureAction.Retry,
          id: source.id,
          seed: source.seed,
        }),
        avatar: createMockAvatarData({ life: 1 }),
      }),
    client: ctx.client,

    // small enough that a multi-attempt plan must split across more than one request
    maxCheckpointsPerBatch: 3,
    progress,
  });

  expect(report.attempts).toBeGreaterThan(1);
  expect(ctx.calls.length).toBeGreaterThan(1);

  // batch N's activityID is exactly the row batch N-1's last continuation minted, proving each
  // batch was awaited (and its mint committed) before the next shipped
  for (const [index, call] of ctx.calls.entries()) {
    if (index === 0) {
      continue;
    }

    const previous = ctx.calls[index - 1];

    invariant(previous !== undefined, 'index > 0 always has a preceding call');

    expect(call.activityID).toBe(previous.continuations.at(-1)!.id);
    expect(call.expectedHead).toBe(0);
  }
});

test('it bails to displaced and reports zero tallies when a batch is rejected', async () => {
  const progress = createMockLatestActivityProgress();

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.SESSION_EVICTED({
        data: { activityID: opts.input.activityID, appendedHead: opts.input.expectedHead },
      });
    }),
  );

  const link = new RPCLink({ url: `${resolveServiceURL('activity')}/rpc` });

  const client: ActivityServiceClient = createORPCClient(link);

  const report = await runFastForward({
    budgetMs: 60_000,
    buildSimulationInput: (source) =>
      Promise.resolve({
        activity: createMockActivityInput({
          encounter: buildWaveTemplate(),
          failureAction: ActivityFailureAction.Abort,

          id: source.id,
          seed: source.seed,
        }),

        // life 1 dies on the first hit taken, so a plan still exists to submit
        avatar: createMockAvatarData({ life: 1 }),
      }),
    client,
    progress,
  });

  expect(report).toStrictEqual({
    activity: progress.activity,
    appendedHead: progress.appendedHead,
    attempts: 0,
    finalRowTerminal: false,
    levelUps: 0,
    reason: 'displaced',
  });
});

test('it propagates a transport failure rather than reporting it as displaced', () => {
  const progress = createMockLatestActivityProgress();

  server.use(mockActivityService.advanceActivity.handler(() => HttpResponse.error()));

  const link = new RPCLink({ url: `${resolveServiceURL('activity')}/rpc` });

  const client: ActivityServiceClient = createORPCClient(link);

  const run = runFastForward({
    budgetMs: 60_000,
    buildSimulationInput: (source) =>
      Promise.resolve({
        activity: createMockActivityInput({
          encounter: buildWaveTemplate(),
          failureAction: ActivityFailureAction.Abort,

          id: source.id,
          seed: source.seed,
        }),

        // life 1 dies on the first hit taken, so a plan still exists to submit
        avatar: createMockAvatarData({ life: 1 }),
      }),
    client,
    progress,
  });

  expect(run).rejects.toThrow();
});

test('it resolves with no fast-forward at all when the confirmed row already reconstructs through its own terminal', async () => {
  const ctx = setupTest();

  // One fixed input template, deep-copied per call — the probe attempt below and the
  // fast-forward's own reconstruction must simulate byte-identically.
  const template = {
    activity: createMockActivityInput({
      encounter: buildWaveTemplate(),
      failureAction: ActivityFailureAction.Retry,
    }),
    avatar: createMockAvatarData(),
  };

  const probeInput = structuredClone(template);

  const probe = await runAttempt(probeInput.activity, probeInput.avatar, {
    maxDurationMs: Number.MAX_SAFE_INTEGER,
  });

  // the confirmed head already covers every checkpoint the row's own attempt ever produces —
  // nothing unconfirmed remains for a fast-forward to catch up
  const progress = createMockLatestActivityProgress({
    activity: createMockActivityData({
      appendedHead: probe.checkpoints.length,
      id: template.activity.id,
      seed: template.activity.seed,
    }),
    appendedHead: probe.checkpoints.length,
  });

  const report = await runFastForward({
    budgetMs: 60_000,
    buildSimulationInput: () => Promise.resolve(structuredClone(template)),
    client: ctx.client,
    progress,
  });

  expect(report).toStrictEqual({
    activity: progress.activity,
    appendedHead: progress.appendedHead,
    attempts: 0,
    finalRowTerminal: false,
    levelUps: 0,
    reason: 'budget-exhausted',
  });

  expect(ctx.calls).toStrictEqual([]);
});
