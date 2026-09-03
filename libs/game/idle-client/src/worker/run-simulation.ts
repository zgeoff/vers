import type { Simulation } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';
import { WorkerMessageType } from '../types';
import { buildDeferred } from './build-deferred';
import { OFFLINE_CAP_WARNING_MS } from './offline-cap-warning-ms';
import { pickPostTerminalAction } from './pick-post-terminal-action';
import type { WorkerContext } from './types';

export async function runSimulation(
  context: WorkerContext,
  simulation: Simulation,
  timestep: number,
) {
  const liveActivity = simulation.activity;

  if (liveActivity === null) {
    return;
  }

  const activityID = liveActivity.id;
  const checkpoint = simulation.run(timestep);

  if (!checkpoint) {
    return;
  }

  // recorded before the submit and independent of the outbox: the next mint folds this run's xp
  // from here whether its checkpoints are still queued or already confirmed and removed
  context.setRunEarnings({ activityID, deltaXP: liveActivity.rewards.xp, tail: checkpoint });

  const version = await context.getSubmitter().submit(activityID, checkpoint);

  if (version !== undefined && checkpoint.rewardSlots.length > 0) {
    context.recordRewardSlots(activityID, { count: checkpoint.rewardSlots.length, version });

    emitRewardSlotsRecorded(context, activityID, version, checkpoint.rewardSlots.length);
  }

  const isTerminal =
    checkpoint.type === ActivityCheckpointType.Completed ||
    checkpoint.type === ActivityCheckpointType.Failed;

  if (!isTerminal) {
    return;
  }

  if (checkpoint.type === ActivityCheckpointType.Completed) {
    emitActivityCompleted(context, activityID);
  }

  const remainingBudgetMs = context.getRemainingBudgetMs();

  const action = pickPostTerminalAction({
    checkpointType: checkpoint.type,
    failureAction: simulation.failureAction,
    remainingBudgetMs,
  });

  if (action === 'stop') {
    simulation.stopActivity();

    return;
  }

  if (action === 'halt-at-boundary') {
    emitCapStatus(context, 0, true);

    return;
  }

  if (remainingBudgetMs <= OFFLINE_CAP_WARNING_MS) {
    emitCapStatus(context, remainingBudgetMs, false);
  }

  const activity = context.getActivity();

  // A start or resync that landed while the terminal batch was awaited owns the runtime now —
  // starting a continuation for this stale row would overwrite its activity and scope. The same
  // guard re-runs inside the queued turn, which may wait behind further flows.
  if (context.getSimulation() !== simulation || activity?.id !== activityID) {
    return;
  }

  const deferred = buildDeferred<void>();

  context.getLifecycle().send({ activity, deferred, simulation, type: 'CONTINUATION' });

  await deferred.promise;
}

function emitActivityCompleted(context: WorkerContext, activityID: string) {
  context.broadcast({ activityID, type: WorkerMessageType.ActivityCompleted });
}

function emitRewardSlotsRecorded(
  context: WorkerContext,
  activityID: string,
  version: number,
  rewardSlotCount: number,
) {
  context.broadcast({
    activityID,
    rewardSlotCount,
    type: WorkerMessageType.RewardSlotsRecorded,
    version,
  });
}

function emitCapStatus(context: WorkerContext, remainingMs: number, halted: boolean) {
  context.broadcast({ halted, remainingMs, type: WorkerMessageType.OfflineCapStatus });
}
