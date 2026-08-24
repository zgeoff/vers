import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { readAllActivityStarts } from './read-all-activity-starts';
import { readLastStartedActivity } from './read-last-started-activity';
import { readNodeSeed } from './read-node-seed';
import { readPendingStopIntent } from './read-pending-stop-intent';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import { removeOfflineWork } from './remove-offline-work';
import { writeActivityStart } from './write-activity-start';
import { writeLastStartedActivity } from './write-last-started-activity';
import { writeNodeSeeds } from './write-node-seeds';
import { writePendingStopIntent } from './write-pending-stop-intent';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

test('it discards every undelivered activity start', async () => {
  await writeActivityStart(createMockActivityData());
  await writeActivityStart(createMockActivityData());
  await removeOfflineWork();

  const remaining = await readAllActivityStarts();

  expect(remaining).toStrictEqual([]);
});

test('it discards the checkpoints queued behind a discarded activity start', async () => {
  const start = createMockActivityData();

  await writeActivityStart(start);
  await writeQueuedCheckpoint(start.id, createMockCheckpointBatchEntry({ version: 1 }));
  await removeOfflineWork();

  const queued = await readQueuedCheckpoints(start.id);

  expect(queued).toStrictEqual([]);
});

test('it discards the undelivered stop intent', async () => {
  await writePendingStopIntent({ activityID: 'act-stopped', avatarID: 'avatar-1' });
  await removeOfflineWork();

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});

test('it discards the last-started activity a later start would stamp as its predecessor', async () => {
  await writeLastStartedActivity({ avatarID: 'avatar-1', lastActivityID: 'act-earlier' });
  await removeOfflineWork();

  const lastStarted = await readLastStartedActivity('avatar-1');

  expect(lastStarted).toBeUndefined();
});

test('it never touches the cached node seeds, which are re-fetchable inputs rather than undelivered work', async () => {
  const seed = createMockNodeSeed({ nodeID: '3_4' });

  await writeNodeSeeds('avatar-1', [seed]);
  await writeActivityStart(createMockActivityData());
  await removeOfflineWork();

  const cached = await readNodeSeed('avatar-1', '3_4');

  expect(cached).toStrictEqual({
    anchor: seed.anchor,
    contentVersion: seed.contentVersion,
    encounterNode: seed.encounterNode,
    genesisSeed: seed.genesisSeed,
  });
});
