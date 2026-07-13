import { expect, test } from 'bun:test';
import type { CheckpointBatchEntry } from '@vers/contract-activity';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import { removeQueuedCheckpoints } from './remove-queued-checkpoints';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

function buildEntry(version: number): CheckpointBatchEntry {
  return {
    hash: `hash_${version}`,
    payload: {
      chainIndex: version,
      entropySource: 'chain',
      nextSeed: `seed_${version}`,
      seed: `seed_${version - 1}`,
      time: version * 1000,
      type: version === 1 ? 'started' : 'progress',
    },
    prevHash: `hash_${version - 1}`,
    version,
  };
}

test('it deletes every queued checkpoint for the activity', async () => {
  const activityID = 'remove-queued-checkpoints-discards';

  await writeQueuedCheckpoint(activityID, buildEntry(1));
  await writeQueuedCheckpoint(activityID, buildEntry(2));
  await removeQueuedCheckpoints(activityID);

  const stored = await readQueuedCheckpoints(activityID);

  expect(stored).toStrictEqual([]);
});

test('it leaves other activities queues untouched', async () => {
  const otherActivityID = 'remove-queued-checkpoints-other';

  await writeQueuedCheckpoint(otherActivityID, buildEntry(1));

  const activityID = 'remove-queued-checkpoints-scoped';

  await writeQueuedCheckpoint(activityID, buildEntry(1));
  await removeQueuedCheckpoints(activityID);

  const otherStored = await readQueuedCheckpoints(otherActivityID);

  expect(otherStored).toHaveLength(1);
});
