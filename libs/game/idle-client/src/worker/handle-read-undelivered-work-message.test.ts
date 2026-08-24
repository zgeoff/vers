import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { handleReadUndeliveredWorkMessage } from './handle-read-undelivered-work-message';

test('it reports what the durable stores hold', async () => {
  const start = createMockActivityData();

  await writeActivityStart(start);

  await writeQueuedCheckpoint(
    start.id,
    createMockCheckpointBatchEntry({ payload: { time: 3000 } }),
  );

  const context = createStubWorkerContext();

  const result = await handleReadUndeliveredWorkMessage(context);

  expect(result.activityCount).toBe(1);
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
