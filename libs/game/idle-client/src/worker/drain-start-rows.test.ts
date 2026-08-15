import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { mockActivityService } from '@vers/mock-services/activity';
import { server } from '../mocks/node';
import { readAllStartRows } from '../submission/read-all-start-rows';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { writeStartRow } from '../submission/write-start-row';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { drainStartRows } from './drain-start-rows';

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

  await writeStartRow(matching);
  await writeStartRow(other);

  server.use(
    mockActivityService.advanceActivity.handler(() => ({ activity: matching, appendedHead: 0 })),
  );

  await drainStartRows(context, 'avatar_recovering');

  const remaining = await readAllStartRows();

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

test('it discards the queued checkpoints of a refused root without registering it', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });

  const row = createMockActivityData({
    avatarID: 'avatar_recovering',
    id: 'act_drain_rejected',
    scopeID: '1_0',
    startKey: 'start_key_rejected',
  });

  await writeStartRow(row);
  await writeQueuedCheckpoint(row.id, createMockCheckpointBatchEntry({ version: 1 }));

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CONFLICT({ data: { activityID: row.id, appendedHead: 4 } });
    }),
  );

  await drainStartRows(context, 'avatar_recovering');

  const remaining = await readAllStartRows();
  const queued = await readQueuedCheckpoints(row.id);

  expect(remaining).toStrictEqual([]);
  expect(queued).toStrictEqual([]);
  expect(submitter.registerActivity).not.toHaveBeenCalled();
});

test('it drains nothing when this device holds no pending root', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });

  await drainStartRows(context, 'avatar_no_rows');

  expect(submitter.registerActivity).not.toHaveBeenCalled();
});
