import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { handleReadUndeliveredWorkMessage } from './handle-read-undelivered-work-message';

test('it reports both durable stores, counting an activity each one holds alone', async () => {
  const start = createMockActivityData();

  await writeActivityStart(start);

  await writeQueuedCheckpoint(
    'act-queued',
    createMockCheckpointBatchEntry({ payload: { time: 1000 }, version: 1 }),
  );

  await writeQueuedCheckpoint(
    'act-queued',
    createMockCheckpointBatchEntry({ payload: { time: 4000 }, version: 2 }),
  );

  const context = createStubWorkerContext();

  const result = await handleReadUndeliveredWorkMessage(context);

  expect(result).toStrictEqual({ activityCount: 2, playMs: 3000 });
});

test('it reports the live activity the context carries', async () => {
  const context = createStubWorkerContext();

  context.setActivity(createMockActivityData({ id: 'act-live' }));

  const result = await handleReadUndeliveredWorkMessage(context);

  expect(result).toStrictEqual({ activityCount: 1, playMs: 0 });
});

test('it reports zero on a clean device', async () => {
  const context = createStubWorkerContext();

  const result = await handleReadUndeliveredWorkMessage(context);

  expect(result).toStrictEqual({ activityCount: 0, playMs: 0 });
});
