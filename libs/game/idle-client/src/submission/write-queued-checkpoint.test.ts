import { expect, test } from 'bun:test';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

test('it stores the entry retrievable by its activity', async () => {
  const activityID = 'write-queued-checkpoint-stores';
  const entry = createMockCheckpointBatchEntry({ version: 1 });

  await writeQueuedCheckpoint(activityID, entry);

  const stored = await readQueuedCheckpoints(activityID);

  expect(stored).toStrictEqual([{ ...entry, activityID }]);
});

test('it overwrites an entry queued for the same activity and version', async () => {
  const activityID = 'write-queued-checkpoint-overwrites';
  const firstEntry = createMockCheckpointBatchEntry({ version: 1 });
  const replacementEntry = { ...firstEntry, hash: 'hash_1_replaced' };

  await writeQueuedCheckpoint(activityID, firstEntry);
  await writeQueuedCheckpoint(activityID, replacementEntry);

  const stored = await readQueuedCheckpoints(activityID);

  expect(stored).toStrictEqual([{ ...replacementEntry, activityID }]);
});
