import { expect, test } from 'bun:test';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import { removeQueuedCheckpoints } from './remove-queued-checkpoints';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

test('it deletes every queued checkpoint for the activity', async () => {
  const activityID = 'remove-queued-checkpoints-discards';

  await writeQueuedCheckpoint(activityID, createMockCheckpointBatchEntry({ version: 1 }));
  await writeQueuedCheckpoint(activityID, createMockCheckpointBatchEntry({ version: 2 }));
  await removeQueuedCheckpoints(activityID);

  const stored = await readQueuedCheckpoints(activityID);

  expect(stored).toStrictEqual([]);
});

test('it leaves other activities queues untouched', async () => {
  const otherActivityID = 'remove-queued-checkpoints-other';

  await writeQueuedCheckpoint(otherActivityID, createMockCheckpointBatchEntry({ version: 1 }));

  const activityID = 'remove-queued-checkpoints-scoped';

  await writeQueuedCheckpoint(activityID, createMockCheckpointBatchEntry({ version: 1 }));
  await removeQueuedCheckpoints(activityID);

  const otherStored = await readQueuedCheckpoints(otherActivityID);

  expect(otherStored).toHaveLength(1);
});
