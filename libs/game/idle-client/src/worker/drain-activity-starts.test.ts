import { expect, mock, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { server } from '../mocks/node';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readLastStartedActivity } from '../submission/read-last-started-activity';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import type { ActivityServiceClient } from '../submission/types';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { WorkerMessageType } from '../types';
import { drainActivityStarts } from './drain-activity-starts';
import { RunOutcomeKind } from './run-outcome-schema';

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
        data: {
          activityID: refused.id,
          appendedHead: 0,
          avatarID: refused.avatarID,
          reason: 'start-hash-mismatch',
        },
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

test('it submits a start refused while its predecessor is still active server-side once per drain, leaving its successor unsubmitted', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client, submitter });
  const track = mock<(activityID: string) => void>();

  const predecessor = await db.activityCollection.create({ avatarID: viewer.avatar.id });

  const deferred = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: 'act_drain_deferred',
    predecessorActivityID: predecessor.id,
    scopeID: '1_0',
    startKey: 'start_key_deferred',
  });

  const successor = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: 'act_drain_deferred_next',
    predecessorActivityID: deferred.id,
    scopeID: '1_0',
    startKey: 'start_key_deferred_next',
  });

  await writeActivityStart(deferred);
  await writeActivityStart(successor);

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      track(opts.input.activityID);

      throw opts.errors.CHECKPOINT_INVALID({
        data: {
          activityID: deferred.id,
          appendedHead: 0,
          avatarID: deferred.avatarID,
          reason: 'build-snapshot-mismatch',
        },
      });
    }),
  );

  await drainActivityStarts(context, viewer.avatar.id);

  const remaining = await readAllActivityStarts();

  expect(track).toHaveBeenCalledExactlyOnceWith(deferred.id);
  expect(remaining).toIncludeSameMembers([deferred, successor]);
  expect(submitter.registerActivity).not.toHaveBeenCalled();
  expect(context.getConnectivityOnline()).toBeTrue();
  expect(context.getBroadcasts()).toStrictEqual([]);
});

test('it drops a start whose snapshot the server refused for good, halts the live run built on it, and folds the next mint from the server’s row', async () => {
  const viewer = await createViewer({ avatar: { level: 2, xp: 105 } });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client, submitter });
  const simulation = createSimulation();
  const track = mock<(activityID: string) => void>();

  const landed = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'stopped',
  });

  const refused = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: 'act_drain_snapshot_wrong',
    predecessorActivityID: landed.id,
    scopeID: '1_0',
    startKey: 'start_key_snapshot_wrong',
  });

  const live = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: 'act_drain_snapshot_wrong_live',
    predecessorActivityID: refused.id,
    scopeID: '1_1',
    startKey: 'start_key_snapshot_wrong_live',
  });

  await writeActivityStart(refused);
  await writeActivityStart(live);
  await writeQueuedCheckpoint(refused.id, createMockCheckpointBatchEntry({ version: 1 }));
  await writeQueuedCheckpoint(live.id, createMockCheckpointBatchEntry({ version: 1 }));
  await writeLastStartedActivity({ avatarID: viewer.avatar.id, lastActivityID: live.id });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: live.id }));
  context.setSimulation(simulation);
  context.setActivity(live);

  context.setLatestRun({
    activityID: live.id,
    avatarID: viewer.avatar.id,
    baselineXP: 0,
    deltaXP: 30,
    tail: null,
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      track(opts.input.activityID);

      throw opts.errors.CHECKPOINT_INVALID({
        data: {
          activityID: refused.id,
          appendedHead: 0,
          avatarID: refused.avatarID,
          reason: 'build-snapshot-mismatch',
        },
      });
    }),
  );

  await drainActivityStarts(context, viewer.avatar.id);

  const remaining = await readAllActivityStarts();
  const refusedQueue = await readQueuedCheckpoints(refused.id);
  const liveQueue = await readQueuedCheckpoints(live.id);
  const lastStarted = await readLastStartedActivity(viewer.avatar.id);

  expect(track).toHaveBeenCalledExactlyOnceWith(refused.id);
  expect(remaining).toStrictEqual([]);
  expect(refusedQueue).toStrictEqual([]);
  expect(liveQueue).toStrictEqual([]);
  expect(submitter.registerActivity).not.toHaveBeenCalled();
  expect(simulation.activity).toBeNull();
  expect(context.getActivity()).toBeNull();

  expect(context.getLatestRun()).toStrictEqual({
    activityID: landed.id,
    avatarID: viewer.avatar.id,
    baselineXP: 105,
    deltaXP: 0,
    tail: null,
  });

  expect(lastStarted).toStrictEqual({ avatarID: viewer.avatar.id, lastActivityID: landed.id });

  expect(context.getBroadcasts()).toStrictEqual([
    {
      state: { failureAction: ActivityFailureAction.Abort },
      type: WorkerMessageType.SimulationUpdate,
    },
    {
      outcome: {
        activityID: live.id,
        avatarID: viewer.avatar.id,
        kind: RunOutcomeKind.Refused,
        scope: { scopeID: '1_1', scopeType: live.scopeType },
        xp: 0,
      },
      type: WorkerMessageType.ActivityEnded,
    },
  ]);
});

test('it clears the fold records when a start is refused for good and the server holds no row for the avatar', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });

  const refused = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: 'act_drain_no_server_row',
    predecessorActivityID: 'act_drain_never_landed',
    scopeID: '1_0',
    startKey: 'start_key_no_server_row',
  });

  await writeActivityStart(refused);
  await writeLastStartedActivity({ avatarID: viewer.avatar.id, lastActivityID: refused.id });

  context.setLatestRun({
    activityID: refused.id,
    avatarID: viewer.avatar.id,
    baselineXP: 0,
    deltaXP: 30,
    tail: null,
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CHECKPOINT_INVALID({
        data: {
          activityID: refused.id,
          appendedHead: 0,
          avatarID: refused.avatarID,
          reason: 'build-snapshot-mismatch',
        },
      });
    }),
  );

  await drainActivityStarts(context, viewer.avatar.id);

  const remaining = await readAllActivityStarts();
  const lastStarted = await readLastStartedActivity(viewer.avatar.id);

  expect(remaining).toStrictEqual([]);
  expect(lastStarted).toBeUndefined();
  expect(context.getLatestRun()).toBeNull();

  expect(context.getBroadcasts()).toStrictEqual([
    {
      outcome: {
        activityID: refused.id,
        avatarID: viewer.avatar.id,
        kind: RunOutcomeKind.Refused,
        scope: { scopeID: '1_0', scopeType: refused.scopeType },
        xp: 0,
      },
      type: WorkerMessageType.ActivityEnded,
    },
  ]);
});
