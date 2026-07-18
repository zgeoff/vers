import { expect, test } from 'bun:test';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import { sweepStaleCheckpoints } from './sweep-stale-checkpoints';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

test('it removes every activity not in the keep list and reports what it removed', async () => {
  await writeQueuedCheckpoint('sweep-stale-kept', createMockCheckpointBatchEntry({ version: 1 }));

  await writeQueuedCheckpoint(
    'sweep-stale-orphan-1',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  await writeQueuedCheckpoint(
    'sweep-stale-orphan-2',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  const swept = await sweepStaleCheckpoints(['sweep-stale-kept']);

  expect(swept).toIncludeSameMembers(['sweep-stale-orphan-1', 'sweep-stale-orphan-2']);

  const kept = await readQueuedCheckpoints('sweep-stale-kept');
  const orphan1 = await readQueuedCheckpoints('sweep-stale-orphan-1');
  const orphan2 = await readQueuedCheckpoints('sweep-stale-orphan-2');

  expect(kept).toHaveLength(1);
  expect(orphan1).toStrictEqual([]);
  expect(orphan2).toStrictEqual([]);
});

test('it leaves every activity in a multi-entry keep list untouched', async () => {
  await writeQueuedCheckpoint('sweep-multi-keep-1', createMockCheckpointBatchEntry({ version: 1 }));
  await writeQueuedCheckpoint('sweep-multi-keep-2', createMockCheckpointBatchEntry({ version: 1 }));
  await writeQueuedCheckpoint('sweep-multi-orphan', createMockCheckpointBatchEntry({ version: 1 }));

  const swept = await sweepStaleCheckpoints(['sweep-multi-keep-1', 'sweep-multi-keep-2']);

  expect(swept).toStrictEqual(['sweep-multi-orphan']);

  const keep1 = await readQueuedCheckpoints('sweep-multi-keep-1');
  const keep2 = await readQueuedCheckpoints('sweep-multi-keep-2');

  expect(keep1).toHaveLength(1);
  expect(keep2).toHaveLength(1);
});

test('it removes every queued activity for an empty keep list', async () => {
  await writeQueuedCheckpoint('sweep-empty-keep-1', createMockCheckpointBatchEntry({ version: 1 }));
  await writeQueuedCheckpoint('sweep-empty-keep-2', createMockCheckpointBatchEntry({ version: 1 }));

  const swept = await sweepStaleCheckpoints([]);

  expect(swept).toIncludeSameMembers(['sweep-empty-keep-1', 'sweep-empty-keep-2']);

  const remaining1 = await readQueuedCheckpoints('sweep-empty-keep-1');
  const remaining2 = await readQueuedCheckpoints('sweep-empty-keep-2');

  expect(remaining1).toStrictEqual([]);
  expect(remaining2).toStrictEqual([]);
});

test('it returns an empty array for an empty store', async () => {
  const swept = await sweepStaleCheckpoints(['sweep-nonexistent-activity']);

  expect(swept).toStrictEqual([]);
});
