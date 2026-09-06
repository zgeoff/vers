import type { Simulation } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { WorkerMessageType } from '../types';
import { buildDeferred } from './build-deferred';
import { handleSimulationUpdate } from './handle-simulation-update';
import { OFFLINE_CAP_WARNING_MS } from './offline-cap-warning-ms';
import { pickPostTerminalAction } from './pick-post-terminal-action';
import type { RunOutcome } from './run-outcome-schema';
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
  const avatar = simulation.avatar;

  invariant(avatar !== null, 'a live activity always has its avatar installed beside it');

  // read before the submit yields: a start that lands during the await installs its own row, and
  // the outcome must name the node this run played, not the one that replaced it
  const endedScope = findEndedScope(context, activityID);
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

  if (
    checkpoint.type !== ActivityCheckpointType.Completed &&
    checkpoint.type !== ActivityCheckpointType.Failed
  ) {
    return;
  }

  emitRunOutcome(context, {
    activityID,
    avatarID: avatar.id,
    kind: checkpoint.type,
    ...(endedScope !== undefined && { scope: endedScope }),
    xp: liveActivity.rewards.xp,
  });

  const remainingBudgetMs = context.getRemainingBudgetMs();

  const action = pickPostTerminalAction({
    checkpointType: checkpoint.type,
    failureAction: simulation.failureAction,
    remainingBudgetMs,
  });

  if (action === 'stop') {
    simulation.stopActivity();

    // the stop fires no tick, so the activity-less snapshot goes out here or never
    handleSimulationUpdate(context);

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

function findEndedScope(context: WorkerContext, activityID: string): RunOutcome['scope'] {
  const row = context.getActivity();

  if (row === null || row.id !== activityID) {
    return undefined;
  }

  return { scopeID: row.scopeID, scopeType: row.scopeType };
}

function emitRunOutcome(context: WorkerContext, outcome: RunOutcome) {
  context.broadcast({ outcome, type: WorkerMessageType.ActivityEnded });
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
