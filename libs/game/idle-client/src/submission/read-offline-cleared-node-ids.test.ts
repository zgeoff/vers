import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityCheckpointType } from '@vers/idle-core';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { readOfflineClearedNodeIDs } from './read-offline-cleared-node-ids';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';
import { writeStartRow } from './write-start-row';

test('it includes a node whose pending root queued a completed terminal', async () => {
  const avatarID = 'avatar-completed-terminal';
  const row = createMockActivityData({ avatarID, scopeID: '3_1' });

  await writeStartRow(row);

  await writeQueuedCheckpoint(
    row.id,
    createMockCheckpointBatchEntry({ payload: { type: ActivityCheckpointType.Completed } }),
  );

  const clearedNodeIDs = await readOfflineClearedNodeIDs(avatarID);

  expect(clearedNodeIDs).toStrictEqual(new Set(['3_1']));
});

test('it excludes a node whose queue holds only non-terminal checkpoints', async () => {
  const avatarID = 'avatar-progress-only';
  const row = createMockActivityData({ avatarID, scopeID: '4_2' });

  await writeStartRow(row);

  await writeQueuedCheckpoint(
    row.id,
    createMockCheckpointBatchEntry({ payload: { type: ActivityCheckpointType.Progress } }),
  );

  const clearedNodeIDs = await readOfflineClearedNodeIDs(avatarID);

  expect(clearedNodeIDs).toStrictEqual(new Set());
});

test('it excludes a node whose pending root queued a failed terminal', async () => {
  const avatarID = 'avatar-failed-terminal';
  const row = createMockActivityData({ avatarID, scopeID: '5_3' });

  await writeStartRow(row);

  await writeQueuedCheckpoint(
    row.id,
    createMockCheckpointBatchEntry({ payload: { type: ActivityCheckpointType.Failed } }),
  );

  const clearedNodeIDs = await readOfflineClearedNodeIDs(avatarID);

  expect(clearedNodeIDs).toStrictEqual(new Set());
});

test('it excludes a pending root belonging to a different avatar', async () => {
  const row = createMockActivityData({ avatarID: 'avatar-owner', scopeID: '6_4' });

  await writeStartRow(row);

  await writeQueuedCheckpoint(
    row.id,
    createMockCheckpointBatchEntry({ payload: { type: ActivityCheckpointType.Completed } }),
  );

  const clearedNodeIDs = await readOfflineClearedNodeIDs('avatar-other');

  expect(clearedNodeIDs).toStrictEqual(new Set());
});

test('it excludes a pending root outside the world-map-node scope', async () => {
  const avatarID = 'avatar-other-scope';

  const row = createMockActivityData({
    avatarID,
    scopeID: 'combat_1',
    scopeType: 'combat_encounter',
  });

  await writeStartRow(row);

  await writeQueuedCheckpoint(
    row.id,
    createMockCheckpointBatchEntry({ payload: { type: ActivityCheckpointType.Completed } }),
  );

  const clearedNodeIDs = await readOfflineClearedNodeIDs(avatarID);

  expect(clearedNodeIDs).toStrictEqual(new Set());
});

test('it returns an empty set with no pending root cached', async () => {
  const clearedNodeIDs = await readOfflineClearedNodeIDs('avatar-no-pending-roots');

  expect(clearedNodeIDs).toStrictEqual(new Set());
});
