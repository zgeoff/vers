import { expect, test } from 'bun:test';
import type { CheckpointBatchEntry } from '@vers/contract-activity';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

test('it stores the entry retrievable by its activity', async () => {
  const activityID = 'write-queued-checkpoint-stores';

  const entry: CheckpointBatchEntry = {
    hash: 'hash_1',
    payload: {
      chainIndex: 1,
      entropySource: 'chain',
      nextSeed: 'seed_1',
      seed: 'seed_0',
      time: 0,
      type: 'started',
    },
    prevHash: 'hash_0',
    version: 1,
  };

  await writeQueuedCheckpoint(activityID, entry);

  const stored = await readQueuedCheckpoints(activityID);

  expect(stored).toStrictEqual([{ ...entry, activityID }]);
});

test('it overwrites an entry queued for the same activity and version', async () => {
  const activityID = 'write-queued-checkpoint-overwrites';

  const firstEntry: CheckpointBatchEntry = {
    hash: 'hash_1',
    payload: {
      chainIndex: 1,
      entropySource: 'chain',
      nextSeed: 'seed_1',
      seed: 'seed_0',
      time: 0,
      type: 'started',
    },
    prevHash: 'hash_0',
    version: 1,
  };

  const replacementEntry: CheckpointBatchEntry = { ...firstEntry, hash: 'hash_1_replaced' };

  await writeQueuedCheckpoint(activityID, firstEntry);
  await writeQueuedCheckpoint(activityID, replacementEntry);

  const stored = await readQueuedCheckpoints(activityID);

  expect(stored).toStrictEqual([{ ...replacementEntry, activityID }]);
});
