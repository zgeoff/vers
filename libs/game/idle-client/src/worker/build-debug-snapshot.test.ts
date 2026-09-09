import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { createMockLiveRun } from '../test-utils/factories/create-mock-live-run';
import { buildDebugSnapshot } from './build-debug-snapshot';

test('it folds the outbox, the live run, and the latest run into one view', () => {
  const liveRun = createMockLiveRun({ id: 'act_live' });

  const pendingStart = createMockActivityData({
    id: 'act_pending',
    predecessorActivityID: 'act_live',
    scopeID: '2_3',
  });

  const snapshot = buildDebugSnapshot({
    capturedAt: 5000,
    checkpoints: [
      { ...createMockCheckpointBatchEntry({ version: 3 }), activityID: 'act_live' },
      { ...createMockCheckpointBatchEntry({ version: 4 }), activityID: 'act_live' },
      { ...createMockCheckpointBatchEntry({ version: 1 }), activityID: 'act_pending' },
    ],
    connectivityOnline: false,
    events: [{ at: 4000, detail: 'offline', type: 'connectivity' }],
    flushRecords: new Map([
      ['act_live', { appendedHead: 2, at: 3000, reason: null, type: 'success' }],
    ]),
    latestRun: {
      activityID: 'act_live',
      avatarID: liveRun.avatarID,
      baselineXP: 10,
      deltaXP: 4,
      tail: null,
    },
    liveRun,
    phase: 'running',
    simulationSpeed: 1,
    startAttempts: new Map([
      [
        'act_pending',
        {
          attempts: 2,
          lastAttemptAt: 4500,
          lastOutcome: 'deferred',
          lastRefusal: { code: 'CHECKPOINT_INVALID', reason: 'build-snapshot-mismatch' },
        },
      ],
    ]),
    starts: [pendingStart],
    submitterStates: [
      {
        activityID: 'act_live',
        expectedHead: 2,
        latestQueuedVersion: 4,
        retryAttempt: 0,
        retryDelayMs: null,
        state: 'scheduled',
      },
    ],
    writer: { bootedAt: 1000, workerID: 'worker_1' },
  });

  expect(snapshot).toStrictEqual({
    capturedAt: 5000,
    connectivityOnline: false,
    events: [{ at: 4000, detail: 'offline', type: 'connectivity' }],
    latestRun: { activityID: 'act_live', avatarID: liveRun.avatarID, baselineXP: 10, deltaXP: 4 },
    liveRun: {
      activityID: 'act_live',
      appendedHead: 2,
      avatarID: liveRun.avatarID,
      lastFlush: { appendedHead: 2, at: 3000, reason: null, type: 'success' },
      scopeID: liveRun.scopeID,
      scopeType: liveRun.scopeType,
    },
    outbox: {
      activityStarts: [
        {
          activityID: 'act_pending',
          attempts: 2,
          avatarID: pendingStart.avatarID,
          deferredUntil: null,
          lastAttemptAt: 4500,
          lastOutcome: 'deferred',
          lastRefusal: { code: 'CHECKPOINT_INVALID', reason: 'build-snapshot-mismatch' },
          predecessorActivityID: 'act_live',
          scopeID: '2_3',
        },
      ],
      checkpoints: [
        {
          activityID: 'act_live',
          count: 2,
          deferredUntil: null,
          highestVersion: 4,
          lastFlush: { appendedHead: 2, at: 3000, reason: null, type: 'success' },
          submitter: {
            expectedHead: 2,
            latestQueuedVersion: 4,
            retryAttempt: 0,
            retryDelayMs: null,
            state: 'scheduled',
          },
        },
        {
          activityID: 'act_pending',
          count: 1,
          deferredUntil: null,
          highestVersion: 1,
          lastFlush: null,
          submitter: null,
        },
      ],
    },
    phase: 'running',
    simulationSpeed: 1,
    writer: { bootedAt: 1000, workerID: 'worker_1' },
  });
});

test('it dates the next retry from the last flush when the submitter is backing off', () => {
  const snapshot = buildDebugSnapshot({
    capturedAt: 9000,
    checkpoints: [{ ...createMockCheckpointBatchEntry({ version: 1 }), activityID: 'act_1' }],
    connectivityOnline: true,
    events: [],
    flushRecords: new Map([
      [
        'act_1',
        { appendedHead: null, at: 8000, reason: 'fetch failed', type: 'transport-failure' },
      ],
    ]),
    latestRun: null,
    liveRun: undefined,
    phase: 'idle',
    simulationSpeed: 1,
    startAttempts: new Map(),
    starts: [createMockActivityData({ id: 'act_1' })],
    submitterStates: [
      {
        activityID: 'act_1',
        expectedHead: 0,
        latestQueuedVersion: 1,
        retryAttempt: 1,
        retryDelayMs: 20_000,
        state: 'retrying',
      },
    ],
    writer: { bootedAt: 1000, workerID: 'worker_1' },
  });

  expect(snapshot.outbox.checkpoints[0]?.deferredUntil).toBe(28_000);
  expect(snapshot.outbox.activityStarts[0]?.deferredUntil).toBe(28_000);
});

test('it reports an empty device with no live run, no latest run, and an empty outbox', () => {
  const snapshot = buildDebugSnapshot({
    capturedAt: 1,
    checkpoints: [],
    connectivityOnline: true,
    events: [],
    flushRecords: new Map(),
    latestRun: null,
    liveRun: undefined,
    phase: 'idle',
    simulationSpeed: 1,
    startAttempts: new Map(),
    starts: [],
    submitterStates: [],
    writer: { bootedAt: 0, workerID: 'worker_1' },
  });

  expect(snapshot).toStrictEqual({
    capturedAt: 1,
    connectivityOnline: true,
    events: [],
    latestRun: null,
    liveRun: null,
    outbox: { activityStarts: [], checkpoints: [] },
    phase: 'idle',
    simulationSpeed: 1,
    writer: { bootedAt: 0, workerID: 'worker_1' },
  });
});
