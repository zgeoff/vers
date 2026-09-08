import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readAllQueuedCheckpoints } from '../submission/read-all-queued-checkpoints';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { handleReadDebugSnapshotMessage } from './handle-read-debug-snapshot-message';

test('it reads both durable stores and the recorder into one snapshot', async () => {
  const context = createStubWorkerContext();
  const start = createMockActivityData({ id: 'act_pending' });

  await writeActivityStart(start);
  await writeQueuedCheckpoint('act_pending', createMockCheckpointBatchEntry({ version: 1 }));
  await writeQueuedCheckpoint('act_pending', createMockCheckpointBatchEntry({ version: 2 }));

  context.getDebugRecorder().recordStartAttempt('act_pending', 'deferred', {
    code: 'AVATAR_NOT_ACTIVE',
    reason: null,
  });

  const snapshot = await handleReadDebugSnapshotMessage(context);

  expect(snapshot).toMatchObject({
    connectivityOnline: true,
    events: [{ detail: 'act_pending deferred refused=AVATAR_NOT_ACTIVE', type: 'start-ingest' }],
    latestRun: null,
    liveRun: null,
    outbox: {
      activityStarts: [
        {
          activityID: 'act_pending',
          attempts: 1,
          lastOutcome: 'deferred',
          lastRefusal: { code: 'AVATAR_NOT_ACTIVE', reason: null },
        },
      ],
      checkpoints: [{ activityID: 'act_pending', count: 2, highestVersion: 2, submitter: null }],
    },
    phase: 'idle',
    simulationSpeed: 1,
    writer: { workerID: context.getDebugRecorder().workerID },
  });
});

test('it leaves both durable stores unchanged', async () => {
  const context = createStubWorkerContext();

  await writeActivityStart(createMockActivityData({ id: 'act_pending' }));
  await writeQueuedCheckpoint('act_pending', createMockCheckpointBatchEntry({ version: 1 }));
  await handleReadDebugSnapshotMessage(context);

  expect(readAllActivityStarts()).resolves.toHaveLength(1);
  expect(readAllQueuedCheckpoints()).resolves.toHaveLength(1);
});
