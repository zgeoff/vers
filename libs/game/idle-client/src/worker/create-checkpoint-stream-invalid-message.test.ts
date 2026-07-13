import { expect, test } from 'bun:test';
import { WorkerMessageType } from '../types';
import { createCheckpointStreamInvalidMessage } from './create-checkpoint-stream-invalid-message';

test('it creates a checkpoint stream invalid message', () => {
  const message = createCheckpointStreamInvalidMessage('activity_1', 'broken-chain-link');

  expect(message).toStrictEqual({
    activityID: 'activity_1',
    reason: 'broken-chain-link',
    type: WorkerMessageType.CheckpointStreamInvalid,
  });
});
