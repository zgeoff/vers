import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readLastStartedActivity } from '../submission/read-last-started-activity';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { createMockLatestActivityProgress } from '../test-utils/factories/create-mock-latest-activity-progress';
import { WorkerMessageType } from '../types';
import { rejectActivityStart } from './reject-activity-start';
import { RunOutcomeKind } from './run-outcome-schema';

test('it drops every pending start chained on the refused one, with their queued checkpoints', async () => {
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

test('it halts the live run built on the refused start and broadcasts the refused outcome for it', async () => {
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
      state: { failureAction: ActivityFailureAction.Abort },
      type: WorkerMessageType.SimulationUpdate,
    },
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
