import { expect, test } from 'bun:test';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { readNodeSeed } from './read-node-seed';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import { writeNodeSeeds } from './write-node-seeds';
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

test("it advances the node's cached anchor with the entry", async () => {
  const seed = createMockNodeSeed({
    avatarID: 'avatar_advance',
    anchor: { chainIndex: 4, nextSeed: 'seed_at_four' },
    nodeID: '2_2',
  });

  await writeNodeSeeds(seed.avatarID, [seed]);

  await writeQueuedCheckpoint('act_advance', createMockCheckpointBatchEntry({ version: 1 }), {
    anchor: { chainIndex: 5, nextSeed: 'seed_at_five' },
    avatarID: seed.avatarID,
    nodeID: seed.nodeID,
  });

  const cached = await readNodeSeed(seed.avatarID, seed.nodeID);

  expect(cached?.anchor).toStrictEqual({ chainIndex: 5, nextSeed: 'seed_at_five' });
});

test('it keeps a cached anchor that is already past the entry, and still queues the entry', async () => {
  const seed = createMockNodeSeed({
    avatarID: 'avatar_ahead',
    anchor: { chainIndex: 9, nextSeed: 'seed_at_nine' },
    nodeID: '2_3',
  });

  const entry = createMockCheckpointBatchEntry({ version: 1 });

  await writeNodeSeeds(seed.avatarID, [seed]);

  await writeQueuedCheckpoint('act_behind', entry, {
    anchor: { chainIndex: 3, nextSeed: 'seed_at_three' },
    avatarID: seed.avatarID,
    nodeID: seed.nodeID,
  });

  const cached = await readNodeSeed(seed.avatarID, seed.nodeID);
  const stored = await readQueuedCheckpoints('act_behind');

  expect(cached?.anchor).toStrictEqual({ chainIndex: 9, nextSeed: 'seed_at_nine' });
  expect(stored).toStrictEqual([{ ...entry, activityID: 'act_behind' }]);
});

test('it queues the entry for a node that was never cached', async () => {
  const entry = createMockCheckpointBatchEntry({ version: 1 });

  await writeQueuedCheckpoint('act_uncached', entry, {
    anchor: { chainIndex: 1, nextSeed: 'seed_at_one' },
    avatarID: 'avatar_uncached',
    nodeID: '7_7',
  });

  const cached = await readNodeSeed('avatar_uncached', '7_7');
  const stored = await readQueuedCheckpoints('act_uncached');

  expect(cached).toBeUndefined();
  expect(stored).toStrictEqual([{ ...entry, activityID: 'act_uncached' }]);
});

test('it queues no entry when the anchor write is interrupted', async () => {
  const seed = createMockNodeSeed({
    avatarID: 'avatar_anchor_fault',
    anchor: { chainIndex: 4, nextSeed: 'seed_at_four' },
    nodeID: '3_3',
  });

  await writeNodeSeeds(seed.avatarID, [seed]);

  // a function is a value the structured clone refuses, so the anchor's write fails after the
  // entry's write is already queued in the same transaction
  const unclonable = { chainIndex: 5, nextSeed: 'seed_at_five', onReached: () => {} };

  const failure = await writeQueuedCheckpoint(
    'act_anchor_fault',
    createMockCheckpointBatchEntry({ version: 1 }),
    { anchor: unclonable, avatarID: seed.avatarID, nodeID: seed.nodeID },
  ).then(
    () => null,
    (error: unknown) => error,
  );

  const stored = await readQueuedCheckpoints('act_anchor_fault');
  const cached = await readNodeSeed(seed.avatarID, seed.nodeID);

  expect(failure).toMatchObject({ name: 'DataCloneError' });
  expect(stored).toStrictEqual([]);
  expect(cached?.anchor).toStrictEqual({ chainIndex: 4, nextSeed: 'seed_at_four' });
});

test("it keeps the node's cached anchor when the entry write is interrupted", async () => {
  const seed = createMockNodeSeed({
    avatarID: 'avatar_entry_fault',
    anchor: { chainIndex: 4, nextSeed: 'seed_at_four' },
    nodeID: '3_4',
  });

  await writeNodeSeeds(seed.avatarID, [seed]);

  const unclonable = { ...createMockCheckpointBatchEntry({ version: 1 }), onQueued: () => {} };

  const failure = await writeQueuedCheckpoint('act_entry_fault', unclonable, {
    anchor: { chainIndex: 5, nextSeed: 'seed_at_five' },
    avatarID: seed.avatarID,
    nodeID: seed.nodeID,
  }).then(
    () => null,
    (error: unknown) => error,
  );

  const stored = await readQueuedCheckpoints('act_entry_fault');
  const cached = await readNodeSeed(seed.avatarID, seed.nodeID);

  expect(failure).toMatchObject({ name: 'DataCloneError' });
  expect(stored).toStrictEqual([]);
  expect(cached?.anchor).toStrictEqual({ chainIndex: 4, nextSeed: 'seed_at_four' });
});
