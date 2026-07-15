import type { ActivityData } from '@vers/contract-activity';
import type { ActivityCheckpoint, Simulation } from '@vers/idle-core';
import { ActivityCheckpointType, buildSimulationInput, createSimulation } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { runReconstruction } from '../resync/run-reconstruction';
import { runResync } from '../resync/run-resync';
import type { FastForwardReport, ResyncPlan, ResyncResult } from '../resync/types';
import type { RequestResyncMessage, ResyncStatus } from '../types';
import { createCheckpointStreamInvalidMessage } from './create-checkpoint-stream-invalid-message';
import { createResyncStatusMessage } from './create-resync-status-message';
import { registerSimulationListeners } from './register-simulation-listeners';
import type { WorkerContext } from './types';

/**
 * Orchestrates one resync request end to end: single-flight per worker, since two concurrent
 * resyncs would each reconstruct their own simulation and race to install it. Every plan kind
 * broadcasts its own `ResyncStatus` progression, ending on `done` (or `capped`) so a connected
 * tab's welcome-back UI always resolves. A live simulation this resync would install is skipped
 * when a different activity went live while it was running — a fresher `SetActivity` always wins.
 */
export async function handleRequestResyncMessage(
  context: WorkerContext,
  message: RequestResyncMessage,
): Promise<void> {
  if (context.isResyncInFlight()) {
    return;
  }

  context.setResyncInFlight(true);
  context.setResyncAvatarID(message.avatarID);

  emitResyncStatus(context, { kind: 'checking' });

  try {
    const result = await runResync({
      avatarID: message.avatarID,
      buildSimulationInput,
      client: context.getClient(),
      onProgress: (progress) => {
        emitResyncStatus(context, { ...progress, kind: 'fast-forwarding' });
      },
      submitter: context.getSubmitter(),
    });

    await applyResyncResult(context, result);
  } finally {
    context.setResyncInFlight(false);
  }
}

async function applyResyncResult(
  context: WorkerContext,
  result: Readonly<ResyncResult>,
): Promise<void> {
  if (result.plan.kind === 'none') {
    emitResyncStatus(context, { attempts: 0, kind: 'done', levelUps: 0 });

    return;
  }

  if (result.plan.kind === 'rebase') {
    emitResyncStatus(context, { kind: 'capped' });

    return;
  }

  if (result.plan.kind === 'attach-live') {
    await applyAttachLive(context, result.plan, result.progress);

    return;
  }

  await applyFastForward(context, result.report);
}

async function applyAttachLive(
  context: WorkerContext,
  plan: Extract<ResyncPlan, { kind: 'attach-live' }>,
  progress: ResyncResult['progress'],
): Promise<void> {
  if (context.getSimulation()?.activity?.id === plan.context.activityID) {
    emitResyncStatus(context, { attempts: 0, kind: 'done', levelUps: 0 });

    return;
  }

  invariant(
    progress !== null,
    'an attach-live plan always carries the progress it was decided from',
  );

  const input = buildSimulationInput(progress.activity);

  if (plan.context.appendedHead === 0) {
    await context.getSubmitter().registerActivity(plan.context);

    const simulation = createSimulation();

    simulation.startActivity(input.avatar, input.activity);

    setLiveSimulation(context, progress.activity, simulation);
    emitResyncStatus(context, { attempts: 0, kind: 'done', levelUps: 0 });

    return;
  }

  const reconstruction = await runReconstruction({
    activity: input.activity,
    appendedHead: plan.context.appendedHead,
    avatar: input.avatar,
  });

  if ('divergence' in reconstruction) {
    emitDivergence(context, plan.context.activityID);
    emitResyncStatus(context, { attempts: 0, kind: 'done', levelUps: 0 });

    return;
  }

  await context.getSubmitter().registerActivity({
    ...plan.context,
    previousNextSeed: reconstruction.lastCheckpoint.nextSeed,
  });

  setLiveSimulation(context, progress.activity, reconstruction.simulation);
  emitResyncStatus(context, { attempts: 0, kind: 'done', levelUps: 0 });
}

async function applyFastForward(
  context: WorkerContext,
  report: FastForwardReport | undefined,
): Promise<void> {
  if (report === undefined) {
    emitResyncStatus(context, { attempts: 0, kind: 'done', levelUps: 0 });

    return;
  }

  if (report.activity.status === 'active' && report.reason !== 'aborted-on-failure') {
    await applyFastForwardAttach(context, report);
  }

  emitResyncStatus(context, {
    attempts: report.attempts,
    kind: 'done',
    levelUps: report.levelUps,
  });
}

/**
 * Attaches the fast-forward's final row live, chaining onto its confirmed head exactly like a
 * plain attach-live resync would: a fresh, checkpoint-0 simulation only when nothing is confirmed
 * yet, otherwise a simulation reconstructed to the confirmed head so the registered cursor's
 * `previousNextSeed` matches what the engine will actually emit next. `report.activity.status` is
 * the row as fetched before this resync's own attempts ran, so it cannot show that the confirmed
 * head itself already reached a terminal checkpoint — that's read off the reconstruction instead,
 * and skips the attach entirely rather than installing a simulation with nothing left to submit.
 */
async function applyFastForwardAttach(
  context: WorkerContext,
  report: FastForwardReport,
): Promise<void> {
  const input = buildSimulationInput(report.activity);

  if (report.appendedHead === 0) {
    await context.getSubmitter().registerActivity({
      activityID: report.activity.id,
      appendedHead: 0,
      lastHash: report.activity.lastHash,
      startChainIndex: report.activity.startChainIndex,
    });

    const simulation = createSimulation();

    simulation.startActivity(input.avatar, input.activity);

    setLiveSimulation(context, report.activity, simulation);

    return;
  }

  const reconstruction = await runReconstruction({
    activity: input.activity,
    appendedHead: report.appendedHead,
    avatar: input.avatar,
  });

  if ('divergence' in reconstruction) {
    emitDivergence(context, report.activity.id);

    return;
  }

  if (isTerminalCheckpoint(reconstruction.lastCheckpoint)) {
    return;
  }

  await context.getSubmitter().registerActivity({
    activityID: report.activity.id,
    appendedHead: report.appendedHead,
    lastHash: report.activity.lastHash,
    previousNextSeed: reconstruction.lastCheckpoint.nextSeed,
    startChainIndex: report.activity.startChainIndex,
  });

  setLiveSimulation(context, report.activity, reconstruction.simulation);
}

function isTerminalCheckpoint(checkpoint: ActivityCheckpoint): boolean {
  return (
    checkpoint.type === ActivityCheckpointType.Completed ||
    checkpoint.type === ActivityCheckpointType.Failed
  );
}

function setLiveSimulation(
  context: WorkerContext,
  activity: Readonly<ActivityData>,
  simulation: Simulation,
): void {
  const currentID = context.getSimulation()?.activity?.id;

  if (currentID !== undefined && currentID !== activity.id) {
    return;
  }

  context.setActivity(activity);
  context.setSimulation(simulation);

  registerSimulationListeners(context, simulation);
}

function emitResyncStatus(context: WorkerContext, status: Readonly<ResyncStatus>): void {
  const message = createResyncStatusMessage(status);

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}

function emitDivergence(context: WorkerContext, activityID: string): void {
  const message = createCheckpointStreamInvalidMessage(activityID, 'reconstruction-divergence');

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}
