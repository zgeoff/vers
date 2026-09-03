import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readAllQueuedCheckpoints } from '../submission/read-all-queued-checkpoints';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { handleRemoveUndeliveredWorkMessage } from './handle-remove-undelivered-work-message';

test('it clears the pending starts and the queued checkpoints, and detaches the live activity', async () => {
  const start = createMockActivityData();

  await writeActivityStart(start);
  await writeQueuedCheckpoint(start.id, createMockCheckpointBatchEntry());

  const context = createStubWorkerContext();

  context.setActivity(start);
  context.setSimulation(createSimulation());

  await handleRemoveUndeliveredWorkMessage(context);

  const remainingStarts = await readAllActivityStarts();
  const remainingCheckpoints = await readAllQueuedCheckpoints();

  expect(remainingStarts).toStrictEqual([]);
  expect(remainingCheckpoints).toStrictEqual([]);
  expect(context.getActivity()).toBeNull();
});
