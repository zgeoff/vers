import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { readAllActivityStarts } from './read-all-activity-starts';
import { readFailureActionCache } from './read-failure-action-cache';
import { readLastStartedActivity } from './read-last-started-activity';
import { readNodeSeed } from './read-node-seed';
import { readPendingStopIntent } from './read-pending-stop-intent';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import { readStartStamps } from './read-start-stamps';
import { removeAvatarOfflineWork } from './remove-avatar-offline-work';
import { writeActivityStart } from './write-activity-start';
import { writeFailureActionCache } from './write-failure-action-cache';
import { writeLastStartedActivity } from './write-last-started-activity';
import { writeNodeSeeds } from './write-node-seeds';
import { writePendingStopIntent } from './write-pending-stop-intent';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';
import { writeStartStamps } from './write-start-stamps';

test("it discards the activity starts of the named avatars and keeps every other avatar's", async () => {
  const owned = createMockActivityData({ avatarID: 'avatar-owned' });
  const foreign = createMockActivityData({ avatarID: 'avatar-foreign' });

  await writeActivityStart(owned);
  await writeActivityStart(foreign);
  await removeAvatarOfflineWork(['avatar-owned']);

  const remaining = await readAllActivityStarts();

  expect(remaining).toStrictEqual([foreign]);
});

test('it discards the checkpoints queued behind a discarded activity start', async () => {
  const start = createMockActivityData({ avatarID: 'avatar-owned' });

  await writeActivityStart(start);
  await writeQueuedCheckpoint(start.id, createMockCheckpointBatchEntry({ version: 1 }));
  await removeAvatarOfflineWork(['avatar-owned']);

  const queued = await readQueuedCheckpoints(start.id);

  expect(queued).toStrictEqual([]);
});

test("it keeps the checkpoints queued behind another avatar's activity start", async () => {
  const foreign = createMockActivityData({ avatarID: 'avatar-foreign' });
  const entry = createMockCheckpointBatchEntry({ version: 1 });

  await writeActivityStart(foreign);
  await writeQueuedCheckpoint(foreign.id, entry);
  await removeAvatarOfflineWork(['avatar-owned']);

  const queued = await readQueuedCheckpoints(foreign.id);

  expect(queued).toStrictEqual([{ ...entry, activityID: foreign.id }]);
});

test('it discards the checkpoints of an activity whose start the server already admitted', async () => {
  await writeQueuedCheckpoint('act-admitted', createMockCheckpointBatchEntry({ version: 1 }));
  await removeAvatarOfflineWork(['avatar-owned']);

  const queued = await readQueuedCheckpoints('act-admitted');

  expect(queued).toStrictEqual([]);
});

test('it discards the stop intent of a named avatar', async () => {
  await writePendingStopIntent({ activityID: 'act-stopped', avatarID: 'avatar-owned' });
  await removeAvatarOfflineWork(['avatar-owned']);

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});

test('it keeps the stop intent of another avatar', async () => {
  await writePendingStopIntent({ activityID: 'act-stopped', avatarID: 'avatar-foreign' });
  await removeAvatarOfflineWork(['avatar-owned']);

  const intent = await readPendingStopIntent();

  expect(intent).toStrictEqual({ activityID: 'act-stopped', avatarID: 'avatar-foreign' });
});

test('it discards the cached failure action of a named avatar', async () => {
  await writeFailureActionCache({
    avatarID: 'avatar-owned',
    dirty: true,
    failureAction: ActivityFailureAction.Retry,
  });

  await removeAvatarOfflineWork(['avatar-owned']);

  const cached = await readFailureActionCache();

  expect(cached).toBeUndefined();
});

test("it discards the last-started activity of a named avatar and keeps another avatar's", async () => {
  await writeLastStartedActivity({ avatarID: 'avatar-owned', lastActivityID: 'act-owned' });
  await writeLastStartedActivity({ avatarID: 'avatar-foreign', lastActivityID: 'act-foreign' });
  await removeAvatarOfflineWork(['avatar-owned']);

  const [owned, foreign] = await Promise.all([
    readLastStartedActivity('avatar-owned'),
    readLastStartedActivity('avatar-foreign'),
  ]);

  expect(owned).toBeUndefined();
  expect(foreign).toStrictEqual({ avatarID: 'avatar-foreign', lastActivityID: 'act-foreign' });
});

test('it never touches the start stamps, which name no avatar', async () => {
  await writeStartStamps({ keyVersion: 1, secretRef: 'ref', secretVersion: 1 });
  await removeAvatarOfflineWork(['avatar-owned']);

  const stamps = await readStartStamps();

  expect(stamps).toStrictEqual({ keyVersion: 1, secretRef: 'ref', secretVersion: 1 });
});

test('it never touches the cached node seeds, which are re-fetchable inputs rather than undelivered work', async () => {
  const seed = createMockNodeSeed({ nodeID: '3_4' });

  await writeNodeSeeds('avatar-owned', [seed]);
  await writeActivityStart(createMockActivityData({ avatarID: 'avatar-owned' }));
  await removeAvatarOfflineWork(['avatar-owned']);

  const cached = await readNodeSeed('avatar-owned', '3_4');

  expect(cached).toStrictEqual({
    anchor: seed.anchor,
    contentVersion: seed.contentVersion,
    encounterNode: seed.encounterNode,
    genesisSeed: seed.genesisSeed,
  });
});
