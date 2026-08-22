import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { mockActivityService } from '@vers/mock-services/activity';
import { server } from '../mocks/node';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readPendingStartIntent } from '../submission/read-pending-start-intent';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import { writeActivityStart } from '../submission/write-activity-start';
import { writePendingStartIntent } from '../submission/write-pending-start-intent';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
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

test('it drops a held start intent naming the refused activityStart', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  const row = createMockActivityData({
    avatarID: 'avatar_recovering',
    id: 'act_drain_intent',
    scopeID: '1_0',
    startKey: 'start_key_intent',
  });

  await writeActivityStart(row);

  await writePendingStartIntent({
    activityID: row.id,
    avatarID: 'avatar_recovering',
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.NODE_NOT_REVEALED({ data: {} });
    }),
  );

  await drainActivityStarts(context, 'avatar_recovering');

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toBeUndefined();
});

test('it leaves a held start intent naming a different row when an activity start is refused', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  const row = createMockActivityData({
    avatarID: 'avatar_recovering',
    id: 'act_drain_refused_other',
    scopeID: '1_0',
    startKey: 'start_key_refused_other',
  });

  await writeActivityStart(row);

  const intent = {
    activityID: 'act_unrelated',
    avatarID: 'avatar_recovering',
    scopeID: '2_0',
    scopeType: 'world_map_node',
  } as const;

  await writePendingStartIntent(intent);

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.NODE_NOT_REVEALED({ data: {} });
    }),
  );

  await drainActivityStarts(context, 'avatar_recovering');

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toStrictEqual(intent);
});

test('it drains nothing when this device holds no pending activityStart', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });

  await drainActivityStarts(context, 'avatar_no_rows');

  expect(submitter.registerActivity).not.toHaveBeenCalled();
});
