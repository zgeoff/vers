import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import { WorkerMessageType } from '../types';
import { workerToClientMessageSchema } from './worker-to-client-message-schema';

test('it accepts a well-formed activity-completed message', () => {
  const message = { activityID: 'activity_1', type: WorkerMessageType.ActivityCompleted };

  expect(workerToClientMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it accepts a well-formed checkpoint-stream-invalid message', () => {
  const message = {
    activityID: 'activity_1',
    type: WorkerMessageType.CheckpointStreamInvalid,
  };

  expect(workerToClientMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it accepts a well-formed failure-action-status message', () => {
  const message = {
    failureAction: ActivityFailureAction.Retry,
    type: WorkerMessageType.FailureActionStatus,
  };

  expect(workerToClientMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it accepts a well-formed offline-cap-status message', () => {
  const message = { halted: true, remainingMs: 0, type: WorkerMessageType.OfflineCapStatus };

  expect(workerToClientMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it accepts a well-formed resync-status message', () => {
  const message = {
    status: { attempts: 2, kind: 'fast-forwarding', levelUps: 1 },
    type: WorkerMessageType.ResyncStatus,
  };

  expect(workerToClientMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it accepts a well-formed reward-slots-recorded message', () => {
  const message = {
    activityID: 'activity_1',
    rewardSlotCount: 2,
    type: WorkerMessageType.RewardSlotsRecorded,
    version: 1,
  };

  expect(workerToClientMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it accepts a well-formed simulation-update message', () => {
  const message = {
    state: { failureAction: ActivityFailureAction.Retry },
    type: WorkerMessageType.SimulationUpdate,
  };

  expect(workerToClientMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it accepts a well-formed writer-displaced message', () => {
  const message = { activityID: 'activity_1', type: WorkerMessageType.WriterDisplaced };

  expect(workerToClientMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it rejects a message with an undeclared discriminant', () => {
  const result = workerToClientMessageSchema.safeParse({ type: 'unknown_message' });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['type'] }));
});

test('it rejects a resync-status message with an undeclared status kind', () => {
  const result = workerToClientMessageSchema.safeParse({
    status: { kind: 'stalled' },
    type: WorkerMessageType.ResyncStatus,
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['status', 'kind'] }),
  );
});

test('it rejects a simulation-update message whose nested snapshot is malformed', () => {
  const result = workerToClientMessageSchema.safeParse({
    state: { failureAction: 'ignore' },
    type: WorkerMessageType.SimulationUpdate,
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['state', 'failureAction'] }),
  );
});
