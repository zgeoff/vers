import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { handleReadUndeliveredWorkMessage } from './handle-read-undelivered-work-message';

test('it reports both durable stores, counting an activity each one holds alone', async () => {
  const start = createMockActivityData({ avatarID: 'avatar-owned' });

  await writeActivityStart(start);

  await writeQueuedCheckpoint(
    'act-queued',
    createMockCheckpointBatchEntry({ payload: { time: 1000 }, version: 1 }),
  );

  await writeQueuedCheckpoint(
    'act-queued',
    createMockCheckpointBatchEntry({ payload: { time: 4000 }, version: 2 }),
  );

  const result = await handleReadUndeliveredWorkMessage({ avatarIDs: ['avatar-owned'] });

  expect(result).toStrictEqual({ activityCount: 2, playMs: 3000 });
});

test('it leaves out an activity start, and its checkpoints, whose avatar the roster does not own', async () => {
  const owned = createMockActivityData({ avatarID: 'avatar-owned' });
  const foreign = createMockActivityData({ avatarID: 'avatar-foreign' });

  await writeActivityStart(owned);
  await writeActivityStart(foreign);

  await writeQueuedCheckpoint(
    foreign.id,
    createMockCheckpointBatchEntry({ payload: { time: 1000 }, version: 1 }),
  );

  await writeQueuedCheckpoint(
    foreign.id,
    createMockCheckpointBatchEntry({ payload: { time: 9000 }, version: 2 }),
  );

  const result = await handleReadUndeliveredWorkMessage({ avatarIDs: ['avatar-owned'] });

  expect(result).toStrictEqual({ activityCount: 1, playMs: 0 });
});

test('it reports zero when every held activity start belongs to another avatar', async () => {
  await writeActivityStart(createMockActivityData({ avatarID: 'avatar-foreign' }));
  await writeActivityStart(createMockActivityData({ avatarID: 'avatar-foreign' }));

  const result = await handleReadUndeliveredWorkMessage({ avatarIDs: ['avatar-owned'] });

  expect(result).toStrictEqual({ activityCount: 0, playMs: 0 });
});

test('it reports zero on a clean device', async () => {
  const result = await handleReadUndeliveredWorkMessage({ avatarIDs: ['avatar-owned'] });

  expect(result).toStrictEqual({ activityCount: 0, playMs: 0 });
});
