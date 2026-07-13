import { expect, test } from 'bun:test';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

test('it returns an empty array for an activity with nothing queued', async () => {
  const stored = await readQueuedCheckpoints('read-queued-checkpoints-empty');

  expect(stored).toStrictEqual([]);
});

test('it returns queued checkpoints in ascending version order', async () => {
  const activityID = 'read-queued-checkpoints-order';

  await writeQueuedCheckpoint(activityID, createMockCheckpointBatchEntry({ version: 3 }));
  await writeQueuedCheckpoint(activityID, createMockCheckpointBatchEntry({ version: 1 }));
  await writeQueuedCheckpoint(activityID, createMockCheckpointBatchEntry({ version: 2 }));

  const stored = await readQueuedCheckpoints(activityID);

  expect(stored.map((entry) => entry.version)).toStrictEqual([1, 2, 3]);
});

test('it only returns checkpoints queued for the named activity', async () => {
  await writeQueuedCheckpoint(
    'read-queued-checkpoints-other',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  const activityID = 'read-queued-checkpoints-scoped';

  await writeQueuedCheckpoint(activityID, createMockCheckpointBatchEntry({ version: 1 }));

  const stored = await readQueuedCheckpoints(activityID);

  expect(stored).toIncludeAllPartialMembers([{ version: 1 }]);
  expect(stored).toHaveLength(1);
});
