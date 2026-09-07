import { expect, test } from 'bun:test';
import { ActivityCheckpointType, ActivityFailureAction } from '@vers/idle-core';
import { createMockRunOutcome } from '../test-utils/factories/create-mock-run-outcome';
import { WorkerMessageType } from '../types';
import { buildDebugEventFromMessage } from './build-debug-event-from-message';

test('it describes a run outcome by activity, kind, and xp', () => {
  const outcome = createMockRunOutcome({
    activityID: 'act_1',
    kind: ActivityCheckpointType.Completed,
    xp: 42,
  });

  expect(
    buildDebugEventFromMessage({ outcome, type: WorkerMessageType.ActivityEnded }),
  ).toStrictEqual({ detail: 'act_1 completed xp=42', type: 'run' });
});

test('it describes a resync status by its kind', () => {
  expect(
    buildDebugEventFromMessage({
      status: { attempts: 2, kind: 'done', levelUps: 0 },
      type: WorkerMessageType.ResyncStatus,
    }),
  ).toStrictEqual({ detail: 'done', type: 'resync' });
});

test('it describes a writer displacement with the displaced activity', () => {
  expect(
    buildDebugEventFromMessage({ activityID: 'act_1', type: WorkerMessageType.WriterDisplaced }),
  ).toStrictEqual({ detail: 'displaced act_1', type: 'writer' });
});

test('it skips the per-tick simulation update', () => {
  expect(
    buildDebugEventFromMessage({
      state: { failureAction: ActivityFailureAction.Abort },
      type: WorkerMessageType.SimulationUpdate,
    }),
  ).toBeNull();
});
