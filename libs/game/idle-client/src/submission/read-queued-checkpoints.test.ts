import { expect, test } from 'bun:test';
import type { CheckpointBatchEntry } from '@vers/contract-activity';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
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

test('it returns an empty array for an activity with nothing queued', async () => {
  const stored = await readQueuedCheckpoints('read-queued-checkpoints-empty');

  expect(stored).toStrictEqual([]);
});

test('it returns queued checkpoints in ascending version order', async () => {
  const activityID = 'read-queued-checkpoints-order';

  await writeQueuedCheckpoint(activityID, buildEntry(3));
  await writeQueuedCheckpoint(activityID, buildEntry(1));
  await writeQueuedCheckpoint(activityID, buildEntry(2));

  const stored = await readQueuedCheckpoints(activityID);

  expect(stored.map((entry) => entry.version)).toStrictEqual([1, 2, 3]);
});

test('it only returns checkpoints queued for the named activity', async () => {
  await writeQueuedCheckpoint('read-queued-checkpoints-other', buildEntry(1));

  const activityID = 'read-queued-checkpoints-scoped';

  await writeQueuedCheckpoint(activityID, buildEntry(1));

  const stored = await readQueuedCheckpoints(activityID);

  expect(stored).toIncludeAllPartialMembers([{ version: 1 }]);
  expect(stored).toHaveLength(1);
});
