import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { mockActivityService } from '@vers/mock-services/activity';
import { server } from '../mocks/node';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readLastStartedActivity } from '../submission/read-last-started-activity';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { WorkerMessageType } from '../types';
import { drainActivityStarts } from './drain-activity-starts';

test("it ingests and registers the recovery avatar's row, leaving another avatar's row untouched", async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });

  const matching = createMockActivityData({
    avatarID: 'avatar_recovering',
    id: 'act_drain_matching',
    scopeID: '1_0',
    startKey: 'start_key_matching',
  });

  const other = createMockActivityData({
    avatarID: 'avatar_other',
    id: 'act_drain_other',
    startKey: 'start_key_other',
  });

  await writeActivityStart(matching);
  await writeActivityStart(other);

  server.use(
    mockActivityService.advanceActivity.handler(() => ({ activity: matching, appendedHead: 0 })),
  );

  await drainActivityStarts(context, 'avatar_recovering');

  const remaining = await readAllActivityStarts();

  expect(remaining).toStrictEqual([other]);

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: matching.id,
    appendedHead: 0,
    avatarID: matching.avatarID,
    lastHash: matching.startHash,
    previousNextSeed: matching.seed,
    scopeID: matching.scopeID,
    startChainIndex: matching.startChainIndex,
  });
});

test('it announces a drained activity start to connected tabs', async () => {
  const context = createStubWorkerContext();

  const row = createMockActivityData({
    avatarID: 'avatar_announcing',
    id: 'act_drain_announced',
    scopeID: '1_0',
    startKey: 'start_key_announced',
  });

  await writeActivityStart(row);

  server.use(
    mockActivityService.advanceActivity.handler(() => ({ activity: row, appendedHead: 0 })),
  );

  await drainActivityStarts(context, 'avatar_announcing');

  expect(context.getBroadcasts()).toStrictEqual([
    { activityID: row.id, type: WorkerMessageType.ActivityStartIngested },
  ]);
});

test('it discards the queued checkpoints of a refused activityStart without registering it', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });

  const row = createMockActivityData({
    avatarID: 'avatar_recovering',
    id: 'act_drain_rejected',
    scopeID: '1_0',
    startKey: 'start_key_rejected',
  });

  await writeActivityStart(row);
  await writeQueuedCheckpoint(row.id, createMockCheckpointBatchEntry({ version: 1 }));

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.NODE_NOT_REVEALED({ data: {} });
    }),
  );

  await drainActivityStarts(context, 'avatar_recovering');

  const remaining = await readAllActivityStarts();
  const queued = await readQueuedCheckpoints(row.id);

  expect(remaining).toStrictEqual([]);
  expect(queued).toStrictEqual([]);
  expect(submitter.registerActivity).not.toHaveBeenCalled();
});

test('it drains nothing when this device holds no pending activityStart', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });

  await drainActivityStarts(context, 'avatar_no_rows');

  expect(submitter.registerActivity).not.toHaveBeenCalled();
});

test('it drops a start the server permanently refuses, its successor, and the last-started record', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });

  const refused = createMockActivityData({
    avatarID: 'avatar_recovering',
    id: 'act_drain_start_hash',
    predecessorActivityID: null,
    scopeID: '1_0',
    startKey: 'start_key_start_hash',
  });

  const successor = createMockActivityData({
    avatarID: 'avatar_recovering',
    id: 'act_drain_start_hash_next',
    predecessorActivityID: refused.id,
    scopeID: '1_0',
    startKey: 'start_key_start_hash_next',
  });

  await writeActivityStart(refused);
  await writeActivityStart(successor);
  await writeLastStartedActivity({ avatarID: successor.avatarID, lastActivityID: successor.id });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CHECKPOINT_INVALID({
        data: { activityID: refused.id, appendedHead: 0, reason: 'start-hash-mismatch' },
      });
    }),
  );

  await drainActivityStarts(context, 'avatar_recovering');

  const remaining = await readAllActivityStarts();
  const lastStarted = await readLastStartedActivity('avatar_recovering');

  expect(remaining).toStrictEqual([]);
  expect(lastStarted).toBeUndefined();
  expect(submitter.registerActivity).not.toHaveBeenCalled();
});
