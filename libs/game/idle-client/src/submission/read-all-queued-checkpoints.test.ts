import { expect, test } from 'bun:test';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { readAllQueuedCheckpoints } from './read-all-queued-checkpoints';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

test('it reads queued checkpoints for two activities together', async () => {
  await writeQueuedCheckpoint('act-1', createMockCheckpointBatchEntry({ version: 1 }));
  await writeQueuedCheckpoint('act-2', createMockCheckpointBatchEntry({ version: 1 }));

  const rows = await readAllQueuedCheckpoints();

  expect(rows.map((row) => row.activityID)).toIncludeSameMembers(['act-1', 'act-2']);
});

test('it reads nothing when no checkpoint is queued', async () => {
  const rows = await readAllQueuedCheckpoints();

  expect(rows).toStrictEqual([]);
});
