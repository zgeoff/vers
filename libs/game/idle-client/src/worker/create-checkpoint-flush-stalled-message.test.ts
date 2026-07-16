import { expect, test } from 'bun:test';
import { WorkerMessageType } from '../types';
import { createCheckpointFlushStalledMessage } from './create-checkpoint-flush-stalled-message';

test('it creates a checkpoint flush stalled message', () => {
  const message = createCheckpointFlushStalledMessage('activity_1', 'network down', 'trace_1');

  expect(message).toStrictEqual({
    activityID: 'activity_1',
    reason: 'network down',
    traceID: 'trace_1',
    type: WorkerMessageType.CheckpointFlushStalled,
  });
});
