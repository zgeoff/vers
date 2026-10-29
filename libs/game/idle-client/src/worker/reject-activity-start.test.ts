import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readLastStartedActivity } from '../submission/read-last-started-activity';
import { readNodeSeed } from '../submission/read-node-seed';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { createMockLatestActivityProgress } from '../test-utils/factories/create-mock-latest-activity-progress';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { WorkerMessageType } from '../types';
import { rejectActivityStart } from './reject-activity-start';
import { RunOutcomeKind } from './run-outcome-schema';

test('it drops the refused start and every pending start chained on it, with their queued checkpoints', async () => {
  const context = createStubWorkerContext();
  const refused = createMockActivityData({ avatarID: 'avatar_refused', id: 'act_refused_root' });

  const successor = createMockActivityData({
    avatarID: 'avatar_refused',
    id: 'act_refused_next',
    predecessorActivityID: refused.id,
  });

  const grandchild = createMockActivityData({
    avatarID: 'avatar_refused',
    id: 'act_refused_next_next',
    predecessorActivityID: successor.id,
  });

  const unrelated = createMockActivityData({
    avatarID: 'avatar_refused',
    id: 'act_refused_unrelated',
    predecessorActivityID: 'act_elsewhere',
  });

  await writeActivityStart(refused);
  await writeActivityStart(successor);
  await writeActivityStart(grandchild);
  await writeActivityStart(unrelated);
  await writeQueuedCheckpoint(refused.id, createMockCheckpointBatchEntry({ version: 1 }));
  await writeQueuedCheckpoint(grandchild.id, createMockCheckpointBatchEntry({ version: 1 }));
  await rejectActivityStart(context, { latest: null, row: refused });

  const remaining = await readAllActivityStarts();
  const refusedQueue = await readQueuedCheckpoints(refused.id);
  const grandchildQueue = await readQueuedCheckpoints(grandchild.id);

  expect(remaining).toStrictEqual([unrelated]);
  expect(refusedQueue).toStrictEqual([]);
  expect(grandchildQueue).toStrictEqual([]);
});

test("it moves the refused start's cached node anchor back to the server's anchor the refusal carried", async () => {
  const context = createStubWorkerContext();

  const seed = createMockNodeSeed({
    avatarID: 'avatar_rewound',
    anchor: { chainIndex: 9, nextSeed: 'seed_local_9' },
    nodeID: '2_3',
  });

  const refused = createMockActivityData({
    avatarID: seed.avatarID,
    id: 'act_rewound_root',
    scopeID: seed.nodeID,
    startChainIndex: 9,
  });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeActivityStart(refused);

  await rejectActivityStart(context, {
    anchor: { chainIndex: 4, nextSeed: 'seed_server_4' },
    latest: null,
    row: refused,
  });

  const cached = await readNodeSeed(seed.avatarID, seed.nodeID);

  expect(cached?.anchor).toStrictEqual({ chainIndex: 4, nextSeed: 'seed_server_4' });
});

test("it moves a node anchor that the refused run advanced back to that run's own start anchor when the refusal carries none", async () => {
  const context = createStubWorkerContext();

  const seed = createMockNodeSeed({
    avatarID: 'avatar_mismatch',
    anchor: { chainIndex: 6, nextSeed: 'seed_start_6' },
    nodeID: '1_2',
  });

  const refused = createMockActivityData({
    avatarID: seed.avatarID,
    id: 'act_mismatch_root',
    scopeID: seed.nodeID,
    seed: 'seed_start_6',
    startChainIndex: 6,
  });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeActivityStart(refused);

  await writeQueuedCheckpoint(refused.id, createMockCheckpointBatchEntry({ version: 2 }), {
    anchor: { chainIndex: 8, nextSeed: 'seed_local_8' },
    avatarID: seed.avatarID,
    nodeID: seed.nodeID,
  });

  await rejectActivityStart(context, { latest: null, row: refused });

  const cached = await readNodeSeed(seed.avatarID, seed.nodeID);

  expect(cached?.anchor).toStrictEqual({ chainIndex: 6, nextSeed: 'seed_start_6' });
});

test('it moves the node anchor of a dropped successor on another node back to its start anchor', async () => {
  const context = createStubWorkerContext();

  const seed = createMockNodeSeed({
    avatarID: 'avatar_cascade',
    anchor: { chainIndex: 3, nextSeed: 'seed_start_3' },
    nodeID: '4_1',
  });

  const refused = createMockActivityData({
    avatarID: seed.avatarID,
    id: 'act_cascade_root',
    scopeID: '0_0',
  });

  const successor = createMockActivityData({
    avatarID: seed.avatarID,
    id: 'act_cascade_next',
    predecessorActivityID: refused.id,
    scopeID: seed.nodeID,
    seed: 'seed_start_3',
    startChainIndex: 3,
  });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeActivityStart(refused);
  await writeActivityStart(successor);

  await writeQueuedCheckpoint(successor.id, createMockCheckpointBatchEntry({ version: 2 }), {
    anchor: { chainIndex: 5, nextSeed: 'seed_local_5' },
    avatarID: seed.avatarID,
    nodeID: seed.nodeID,
  });

  await rejectActivityStart(context, { latest: null, row: refused });

  const cached = await readNodeSeed(seed.avatarID, seed.nodeID);

  expect(cached?.anchor).toStrictEqual({ chainIndex: 3, nextSeed: 'seed_start_3' });
});

test('it moves a node anchor back to the earliest of the dropped starts on that node', async () => {
  const context = createStubWorkerContext();

  const seed = createMockNodeSeed({
    avatarID: 'avatar_replayed',
    anchor: { chainIndex: 9, nextSeed: 'seed_local_9' },
    nodeID: '3_3',
  });

  const refused = createMockActivityData({
    avatarID: seed.avatarID,
    id: 'act_replayed_root',
    scopeID: seed.nodeID,
    seed: 'seed_start_2',
    startChainIndex: 2,
  });

  const continuation = createMockActivityData({
    avatarID: seed.avatarID,
    id: 'act_replayed_next',
    predecessorActivityID: refused.id,
    scopeID: seed.nodeID,
    seed: 'seed_start_5',
    startChainIndex: 5,
  });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeActivityStart(refused);
  await writeActivityStart(continuation);
  await rejectActivityStart(context, { latest: null, row: refused });

  const cached = await readNodeSeed(seed.avatarID, seed.nodeID);

  expect(cached?.anchor).toStrictEqual({ chainIndex: 2, nextSeed: 'seed_start_2' });
});

test('it records the refused start, the live run it ends, every dropped start and the anchor it carried', async () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();
  const refused = createMockActivityData({ avatarID: 'avatar_recorded', id: 'act_recorded_root' });

  const live = createMockActivityData({
    avatarID: 'avatar_recorded',
    id: 'act_recorded_next',
    predecessorActivityID: refused.id,
  });

  await writeActivityStart(refused);
  await writeActivityStart(live);

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: live.id }));
  context.setSimulation(simulation);
  context.setActivity(live);

  await rejectActivityStart(context, {
    anchor: { chainIndex: 2, nextSeed: 'seed_server_2' },
    latest: null,
    row: refused,
  });

  expect(context.getDebugRecorder().getEvents()).toPartiallyContain({
    detail:
      'act_recorded_root held=act_recorded_next dropped=act_recorded_root,act_recorded_next anchor=2',
    type: 'refusal',
  });
});

test('it halts the live run built on the refused start and broadcasts its refused outcome before the update that clears it', async () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();
  const refused = createMockActivityData({ avatarID: 'avatar_live', id: 'act_live_root' });

  const live = createMockActivityData({
    avatarID: 'avatar_live',
    id: 'act_live_next',
    predecessorActivityID: refused.id,
    scopeID: '2_1',
  });

  await writeActivityStart(live);

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: live.id }));
  context.setSimulation(simulation);
  context.setActivity(live);

  await rejectActivityStart(context, { latest: null, row: refused });

  expect(simulation.activity).toBeNull();
  expect(context.getActivity()).toBeNull();
  expect(context.getSimulation()).not.toBe(simulation);

  expect(context.getBroadcasts()).toStrictEqual([
    {
      outcome: {
        activityID: live.id,
        avatarID: live.avatarID,
        kind: RunOutcomeKind.Refused,
        scope: { scopeID: '2_1', scopeType: live.scopeType },
        xp: 0,
      },
      type: WorkerMessageType.ActivityEnded,
    },
    {
      state: { failureAction: ActivityFailureAction.Abort },
      type: WorkerMessageType.SimulationUpdate,
    },
  ]);
});

test('it leaves an unrelated live run ticking and names the refused start in the outcome', async () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();
  const refused = createMockActivityData({ avatarID: 'avatar_other_live', id: 'act_other_root' });
  const live = createMockActivityData({ avatarID: 'avatar_other_live', id: 'act_other_live' });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: live.id }));
  context.setSimulation(simulation);
  context.setActivity(live);

  await rejectActivityStart(context, { latest: null, row: refused });

  expect(simulation.activity).not.toBeNull();
  expect(context.getActivity()).toStrictEqual(live);

  expect(context.getBroadcasts()).toStrictEqual([
    {
      outcome: {
        activityID: refused.id,
        avatarID: refused.avatarID,
        kind: RunOutcomeKind.Refused,
        scope: { scopeID: refused.scopeID, scopeType: refused.scopeType },
        xp: 0,
      },
      type: WorkerMessageType.ActivityEnded,
    },
  ]);
});

test("it resets the next mint's fold source and predecessor to the server's latest row", async () => {
  const context = createStubWorkerContext();
  const refused = createMockActivityData({ avatarID: 'avatar_reset', id: 'act_reset_root' });
  const serverRow = createMockActivityData({ avatarID: 'avatar_reset', status: 'stopped' });

  context.setLatestRun({
    activityID: refused.id,
    avatarID: 'avatar_reset',
    baselineXP: 0,
    deltaXP: 40,
    tail: null,
  });

  await writeLastStartedActivity({ avatarID: 'avatar_reset', lastActivityID: refused.id });

  await rejectActivityStart(context, {
    latest: createMockLatestActivityProgress({
      activity: serverRow,
      optimisticBuild: { level: 2, xp: 105 },
    }),
    row: refused,
  });

  const lastStarted = await readLastStartedActivity('avatar_reset');

  expect(context.getLatestRun()).toStrictEqual({
    activityID: serverRow.id,
    avatarID: 'avatar_reset',
    baselineXP: 105,
    deltaXP: 0,
    tail: null,
  });

  expect(lastStarted).toStrictEqual({ avatarID: 'avatar_reset', lastActivityID: serverRow.id });
});

test('it clears both records when the server holds no activity for the avatar', async () => {
  const context = createStubWorkerContext();
  const refused = createMockActivityData({ avatarID: 'avatar_clear', id: 'act_clear_root' });

  context.setLatestRun({
    activityID: refused.id,
    avatarID: 'avatar_clear',
    baselineXP: 0,
    deltaXP: 40,
    tail: null,
  });

  await writeLastStartedActivity({ avatarID: 'avatar_clear', lastActivityID: refused.id });
  await rejectActivityStart(context, { latest: null, row: refused });

  const lastStarted = await readLastStartedActivity('avatar_clear');

  expect(context.getLatestRun()).toBeNull();
  expect(lastStarted).toBeUndefined();
});

test('it clears both records when they name a run the server no longer holds, as after an account reset', async () => {
  const context = createStubWorkerContext();
  const refused = createMockActivityData({ avatarID: 'avatar_wiped', id: 'act_wiped_root' });

  context.setLatestRun({
    activityID: 'act_wiped_before_reset',
    avatarID: 'avatar_wiped',
    baselineXP: 0,
    deltaXP: 40,
    tail: null,
  });

  await writeLastStartedActivity({
    avatarID: 'avatar_wiped',
    lastActivityID: 'act_wiped_before_reset',
  });

  await rejectActivityStart(context, { latest: null, row: refused });

  const lastStarted = await readLastStartedActivity('avatar_wiped');

  expect(context.getLatestRun()).toBeNull();
  expect(lastStarted).toBeUndefined();
});

test('it keeps both records when the server holds no activity and they name a start still waiting in the outbox', async () => {
  const context = createStubWorkerContext();
  const refused = createMockActivityData({ avatarID: 'avatar_waiting', id: 'act_waiting_root' });
  const waiting = createMockActivityData({ avatarID: 'avatar_waiting', id: 'act_waiting_kept' });

  const held = {
    activityID: waiting.id,
    avatarID: 'avatar_waiting',
    baselineXP: 0,
    deltaXP: 15,
    tail: null,
  };

  context.setLatestRun(held);

  await writeActivityStart(waiting);
  await writeLastStartedActivity({ avatarID: 'avatar_waiting', lastActivityID: waiting.id });
  await rejectActivityStart(context, { latest: null, row: refused });

  const lastStarted = await readLastStartedActivity('avatar_waiting');

  expect(context.getLatestRun()).toStrictEqual(held);
  expect(lastStarted).toStrictEqual({ avatarID: 'avatar_waiting', lastActivityID: waiting.id });
});

test('it keeps both records when they name a run that survives the drop', async () => {
  const context = createStubWorkerContext();
  const refused = createMockActivityData({ avatarID: 'avatar_keep', id: 'act_keep_root' });
  const survivor = createMockActivityData({ avatarID: 'avatar_keep', id: 'act_keep_survivor' });

  const held = {
    activityID: survivor.id,
    avatarID: 'avatar_keep',
    baselineXP: 10,
    deltaXP: 5,
    tail: null,
  };

  context.setLatestRun(held);

  await writeLastStartedActivity({ avatarID: 'avatar_keep', lastActivityID: survivor.id });

  await rejectActivityStart(context, {
    latest: createMockLatestActivityProgress({ optimisticBuild: { level: 2, xp: 105 } }),
    row: refused,
  });

  const lastStarted = await readLastStartedActivity('avatar_keep');

  expect(context.getLatestRun()).toStrictEqual(held);
  expect(lastStarted).toStrictEqual({ avatarID: 'avatar_keep', lastActivityID: survivor.id });
});

test("it keeps another avatar's fold record when clearing this avatar's", async () => {
  const context = createStubWorkerContext();
  const refused = createMockActivityData({ avatarID: 'avatar_clear_mine', id: 'act_clear_mine' });

  const other = {
    activityID: 'act_theirs',
    avatarID: 'avatar_theirs',
    baselineXP: 10,
    deltaXP: 0,
    tail: null,
  };

  context.setLatestRun(other);

  await rejectActivityStart(context, { latest: null, row: refused });

  expect(context.getLatestRun()).toStrictEqual(other);
});

test('it aborts an in-flight flow before it can chain a fresh start on the refused one', async () => {
  const context = createStubWorkerContext();
  const refused = createMockActivityData({ avatarID: 'avatar_abort', id: 'act_abort_root' });
  const scope = context.getCancelSignal();

  await rejectActivityStart(context, { latest: null, row: refused });

  expect(scope.aborted).toBeTrue();
  expect(context.getCancelSignal().aborted).toBeFalse();
});

test("it moves a dropped successor's node anchor back on the retry of a drop that stopped part way", async () => {
  const stopping = createStubWorkerContext({
    broadcast: () => {
      throw new Error('worker stopped');
    },
  });

  const seed = createMockNodeSeed({
    avatarID: 'avatar_resumed',
    anchor: { chainIndex: 4, nextSeed: 'seed_start_4' },
    nodeID: '5_2',
  });

  const refused = createMockActivityData({
    avatarID: seed.avatarID,
    id: 'act_resumed_root',
    scopeID: '0_0',
  });

  const live = createMockActivityData({
    avatarID: seed.avatarID,
    id: 'act_resumed_live',
    predecessorActivityID: refused.id,
    scopeID: seed.nodeID,
    seed: 'seed_start_4',
    startChainIndex: 4,
  });

  const simulation = createSimulation();

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeActivityStart(refused);
  await writeActivityStart(live);

  await writeQueuedCheckpoint(live.id, createMockCheckpointBatchEntry({ version: 2 }), {
    anchor: { chainIndex: 6, nextSeed: 'seed_local_6' },
    avatarID: seed.avatarID,
    nodeID: seed.nodeID,
  });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: live.id }));
  stopping.setSimulation(simulation);
  stopping.setActivity(live);

  await rejectActivityStart(stopping, { latest: null, row: refused }).catch(() => {});
  await rejectActivityStart(createStubWorkerContext(), { latest: null, row: refused });

  const cached = await readNodeSeed(seed.avatarID, seed.nodeID);

  expect(cached?.anchor).toStrictEqual({ chainIndex: 4, nextSeed: 'seed_start_4' });
});

test('it keeps the refused root when the drop fails part way, so the next reconnect retries it', async () => {
  const context = createStubWorkerContext({
    broadcast: () => {
      throw new Error('channel closed');
    },
  });

  const simulation = createSimulation();
  const refused = createMockActivityData({ avatarID: 'avatar_retry', id: 'act_retry_root' });

  const live = createMockActivityData({
    avatarID: 'avatar_retry',
    id: 'act_retry_live',
    predecessorActivityID: refused.id,
  });

  await writeActivityStart(refused);
  await writeActivityStart(live);
  await writeQueuedCheckpoint(refused.id, createMockCheckpointBatchEntry({ version: 1 }));

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: live.id }));
  context.setSimulation(simulation);
  context.setActivity(live);

  const rejection = rejectActivityStart(context, { latest: null, row: refused });

  await rejection.catch(() => {});

  expect(rejection).rejects.toThrowWithMessage(Error, 'channel closed');

  const remaining = await readAllActivityStarts();
  const refusedQueue = await readQueuedCheckpoints(refused.id);

  expect(remaining).toIncludeSameMembers([refused, live]);
  expect(refusedQueue).toHaveLength(1);
});
