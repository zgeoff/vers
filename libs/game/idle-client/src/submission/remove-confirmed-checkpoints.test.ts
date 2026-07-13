import { expect, test } from 'bun:test';
import type { CheckpointBatchEntry } from '@vers/contract-activity';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import { removeConfirmedCheckpoints } from './remove-confirmed-checkpoints';
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

test('it deletes queued checkpoints at or below the confirmed head', async () => {
  const activityID = 'remove-confirmed-checkpoints-trims';

  await writeQueuedCheckpoint(activityID, buildEntry(1));
  await writeQueuedCheckpoint(activityID, buildEntry(2));
  await writeQueuedCheckpoint(activityID, buildEntry(3));
  await removeConfirmedCheckpoints(activityID, 2);

  const stored = await readQueuedCheckpoints(activityID);

  expect(stored.map((entry) => entry.version)).toStrictEqual([3]);
});

test('it deletes nothing when the confirmed head is zero', async () => {
  const activityID = 'remove-confirmed-checkpoints-zero-head';

  await writeQueuedCheckpoint(activityID, buildEntry(1));
  await removeConfirmedCheckpoints(activityID, 0);

  const stored = await readQueuedCheckpoints(activityID);

  expect(stored.map((entry) => entry.version)).toStrictEqual([1]);
});

test('it leaves other activities queues untouched', async () => {
  const otherActivityID = 'remove-confirmed-checkpoints-other';

  await writeQueuedCheckpoint(otherActivityID, buildEntry(1));

  const activityID = 'remove-confirmed-checkpoints-scoped';

  await writeQueuedCheckpoint(activityID, buildEntry(1));
  await removeConfirmedCheckpoints(activityID, 1);

  const otherStored = await readQueuedCheckpoints(otherActivityID);

  expect(otherStored.map((entry) => entry.version)).toStrictEqual([1]);
});
