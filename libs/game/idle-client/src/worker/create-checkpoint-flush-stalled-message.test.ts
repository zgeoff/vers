import { expect, test } from 'bun:test';
import type { WorkerMessageType } from '../types';
import { createCheckpointFlushStalledMessage } from './create-checkpoint-flush-stalled-message';

test('it creates a checkpoint flush stalled message', () => {
  const message = createCheckpointFlushStalledMessage('activity_1', 'network down', 'trace_1');

  // the literal pins the wire discriminator so an enum-value change fails this test
  expect(message).toStrictEqual({
    activityID: 'activity_1',
    reason: 'network down',
    traceID: 'trace_1',
    type: 'checkpoint_flush_stalled' as WorkerMessageType.CheckpointFlushStalled,
  });
});
