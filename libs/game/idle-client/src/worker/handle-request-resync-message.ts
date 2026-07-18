import { isDefinedError, ORPCError, safe } from '@orpc/client';
import type {
  ActivityData,
  ActivityFailureAction as ContractFailureAction,
} from '@vers/contract-activity';
import type { ActivityCheckpoint, Simulation } from '@vers/idle-core';
import {
  ActivityCheckpointType,
  ActivityFailureAction,
  buildSimulationInput,
  createSimulation,
} from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { runReconstruction } from '../resync/run-reconstruction';
import { runResync } from '../resync/run-resync';
import type { FastForwardReport, ResyncPlan, ResyncResult } from '../resync/types';
import { readFailureActionCache } from '../submission/read-failure-action-cache';
import { sweepStaleCheckpoints } from '../submission/sweep-stale-checkpoints';
import { writeFailureActionCache } from '../submission/write-failure-action-cache';
import type { RequestResyncMessage, ResyncStatus } from '../types';
import { createCheckpointStreamInvalidMessage } from './create-checkpoint-stream-invalid-message';
import { createConnectionStatusMessage } from './create-connection-status-message';
import { createFailureActionStatusMessage } from './create-failure-action-status-message';
import { createOfflineCapStatusMessage } from './create-offline-cap-status-message';
import { createResyncStatusMessage } from './create-resync-status-message';
import { registerSimulationListeners } from './register-simulation-listeners';
import { reportWorkerFault } from './report-worker-fault';
import type { WorkerContext } from './types';

/**
 * Orchestrates one resync request end to end: single-flight per worker, since two concurrent
 * resyncs would each reconstruct their own simulation and race to install it. Only a plan that
 * covers a real away period — a fast-forward or a capped rebase — broadcasts a `ResyncStatus`
 * progression, ending on `done` (or `capped`) so a connected tab's welcome-back UI always
 * resolves; a zero-gap outcome (live re-attach, no activity) stays silent, so a fresh login never
 * opens that UI. A live simulation this resync would install is skipped when a different activity
 * went live while it was running — a fresher `SetActivity` always wins. Once the plan settles, the
 * durable checkpoint queue is swept down to the determined latest activity plus whichever activity
 * is live at sweep time — a fresher activity installed mid-resync keeps its writer's queued rows —
 * since a prior worker lifetime's stranded rows for any other activity have no delivery path and
 * are worthless. A resync that fails outright forwards the fault to the error backend and
 * broadcasts a `failed` `ResyncStatus` for the requesting avatar, never a connection-status change
 * — connectivity is the connection layer's own signal, not a resync outcome — and never rejects; a
 * tab's retry re-requests it. One failure cause is routed apart: an `UNAUTHORIZED` rejection
 * broadcasts `session-expired` instead, with no fault report — the session lapsing is expected
 * behaviour whose only remedy is a fresh sign-in, so a tab renders a sign-in path rather than a
 * retry that can never succeed.
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

  try {
    // Held batches must land before the progress fetch, or the resync plans against an appended
    // head those checkpoints are still about to advance.
    await context.getSubmitter().flushHeld();

    const result = await runResync({
      avatarID: message.avatarID,
      buildSimulationInput: (activity) =>
        buildSimulationInput(activity, { failureAction: context.getFailureAction() }),
      client: context.getClient(),
      isActivityLive: (activityID) => context.getSimulation()?.activity?.id === activityID,
      onProgress: (progress) => {
        emitResyncStatus(context, { ...progress, kind: 'fast-forwarding' });
      },
      onProgressFetched: async (progress) => {
        // The dirty local value is flushed only when the cached record was set for this avatar;
        // otherwise the server's value wins, and the cache is rewritten clean for this avatar so a
        // dirty value left over from a different avatar this worker drove earlier is discarded
        // rather than delivered to the wrong row.
        const cached = await readFailureActionCache();

        if (context.isFailureActionDirty() && cached?.avatarID === message.avatarID) {
          await flushFailureAction(context, message.avatarID);

          return;
        }

        await updateFailureActionFromServer(
          context,
          message.avatarID,
          toActivityFailureAction(progress.failureAction),
        );
      },
      pendingContinuation: context.getPendingContinuation(),
      submitter: context.getSubmitter(),
    });

    await sweepStaleActivities(context, result);
    await applyResyncResult(context, result);
  } catch (error) {
    if (error instanceof ORPCError && error.code === 'UNAUTHORIZED') {
      emitResyncStatus(context, { avatarID: message.avatarID, kind: 'session-expired' });
    } else {
      reportWorkerFault('resync', error);
      emitResyncStatus(context, { avatarID: message.avatarID, kind: 'failed' });
    }
  } finally {
    context.setResyncInFlight(false);
  }
}

function toActivityFailureAction(failureAction: ContractFailureAction): ActivityFailureAction {
  return failureAction === 'retry' ? ActivityFailureAction.Retry : ActivityFailureAction.Abort;
}

/**
 * Delivers a dirty local failure-action value to the server as the offline outbox's one entry:
 * best-effort, so a delivery failure leaves it dirty for the next resync's reconcile to retry.
 */
async function flushFailureAction(context: WorkerContext, avatarID: string): Promise<void> {
  const failureAction = context.getFailureAction();

  const [error] = await safe(context.getClient().updateFailureAction({ avatarID, failureAction }));

  if (error !== null) {
    return;
  }

  context.setFailureActionDirty(false);

  await writeFailureActionCache({ avatarID, dirty: false, failureAction });
}

/**
 * Adopts the server's failure action as the in-session and cached truth for the resyncing avatar,
 * clearing any dirty flag and broadcasting only when the effective value actually changed.
 */
async function updateFailureActionFromServer(
  context: WorkerContext,
  avatarID: string,
  failureAction: ActivityFailureAction,
): Promise<void> {
  const changed = failureAction !== context.getFailureAction();

  context.setFailureAction(failureAction);
  context.setFailureActionDirty(false);

  await writeFailureActionCache({ avatarID, dirty: false, failureAction });

  if (changed) {
    emitFailureActionStatus(context, failureAction);
  }
}

/**
 * Sweeps every queued checkpoint outside the resync's determined latest activity and the activity
 * live at sweep time — a fresher activity can go live while the resync is still running, and its
 * queued rows are its running writer's own pipeline, never stranded work. Outside those, a worker
 * restart has no delivery path for a stranded row, and the server settles rewards authoritatively,
 * so nothing else is ever worth keeping. Returns the swept activity ids. Failure never fails the
 * resync: it only reports the fault and returns nothing swept, since a stranded row costs nothing
 * but disk until the next sweep.
 */
async function sweepStaleActivities(
  context: WorkerContext,
  result: Readonly<ResyncResult>,
): Promise<Array<string>> {
  try {
    const keepActivityIDs = [
      ...new Set(
        [pickLatestActivityID(result), context.getSimulation()?.activity?.id].filter(
          (activityID): activityID is string => activityID !== undefined,
        ),
      ),
    ];

    return await sweepStaleCheckpoints(keepActivityIDs);
  } catch (error) {
    reportWorkerFault('resync', error);

    return [];
  }
}

function pickLatestActivityID(result: Readonly<ResyncResult>): string | undefined {
  if (result.report !== undefined) {
    return result.report.activity.id;
  }

  if (result.plan.kind === 'none') {
    return undefined;
  }

  return result.plan.context.activityID;
}

async function applyResyncResult(
  context: WorkerContext,
  result: Readonly<ResyncResult>,
): Promise<void> {
  if (result.report !== undefined) {
    await applyFastForward(context, result.report);

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

  if (result.plan.kind === 'continue') {
    await applyContinue(context, result.plan);
  }
}

async function applyAttachLive(
  context: WorkerContext,
  plan: Extract<ResyncPlan, { kind: 'attach-live' }>,
  progress: ResyncResult['progress'],
): Promise<void> {
  if (context.getSimulation()?.activity?.id === plan.context.activityID) {
    return;
  }

  invariant(
    progress !== null,
    'an attach-live plan always carries the progress it was decided from',
  );

  const input = buildSimulationInput(progress.activity, {
    failureAction: context.getFailureAction(),
  });

  if (plan.context.appendedHead === 0) {
    await context.getSubmitter().registerActivity(plan.context);

    const simulation = createSimulation();

    simulation.startActivity(input.avatar, input.activity);

    setLiveSimulation(context, progress.activity, simulation);

    return;
  }

  const reconstruction = await runReconstruction({
    activity: input.activity,
    appendedHead: plan.context.appendedHead,
    avatar: input.avatar,
  });

  if ('divergence' in reconstruction) {
    emitDivergence(context, plan.context.activityID);

    return;
  }

  await context.getSubmitter().registerActivity({
    ...plan.context,
    previousNextSeed: reconstruction.lastCheckpoint.nextSeed,
  });

  setLiveSimulation(context, progress.activity, reconstruction.simulation);
}

/**
 * Starts the row a pending continuation wanted, now that its target has read closed. A budget
 * already spent halts at the boundary exactly like a live continuation would, keeping the pending
 * record for the next reconnect. `startActivity` answering with a fresh, never-appended row is
 * adopted directly, mirroring `runContinuation`'s own same-scope race handling; any other defined
 * error clears the pending record and rethrows, reported through the caller's own resync-failure
 * handling; a transport failure keeps the pending record and reports the worker offline, leaving
 * the next reconnect to retry.
 */
async function applyContinue(
  context: WorkerContext,
  plan: Extract<ResyncPlan, { kind: 'continue' }>,
): Promise<void> {
  const pending = context.getPendingContinuation();

  invariant(pending !== null, 'a continue plan is only reached with a pending continuation');

  if (context.getRemainingBudgetMs() <= 0) {
    emitCapStatus(context, 0, true);

    return;
  }

  const [error, started] = await safe(
    context.getClient().startActivity({
      avatarID: plan.activity.avatarID,
      scopeID: plan.activity.scopeID,
      scopeType: plan.activity.scopeType,
    }),
  );

  if (error === null) {
    await startContinuedActivity(context, started, pending.failureAction);

    context.setPendingContinuation(null);

    return;
  }

  if (isDefinedError(error) && error.code === 'CONFLICT') {
    const row = error.data.activity;

    if (row.appendedHead === 0 && row.id !== plan.activity.id) {
      await startContinuedActivity(context, row, pending.failureAction);

      context.setPendingContinuation(null);

      return;
    }
  }

  if (!isDefinedError(error)) {
    emitConnectionStatus(context, false);

    return;
  }

  context.setPendingContinuation(null);
  throw error;
}

async function startContinuedActivity(
  context: WorkerContext,
  row: Readonly<ActivityData>,
  failureAction: ActivityFailureAction,
): Promise<void> {
  const input = buildSimulationInput(row, { failureAction });

  await context.getSubmitter().registerActivity({
    activityID: row.id,
    appendedHead: 0,
    lastHash: row.startHash,
    startChainIndex: row.startChainIndex,
  });

  const simulation = createSimulation();

  simulation.startActivity(input.avatar, input.activity);

  setLiveSimulation(context, row, simulation);
}

async function applyFastForward(context: WorkerContext, report: FastForwardReport): Promise<void> {
  if (report.activity.status === 'active' && !report.finalRowTerminal) {
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
 * `previousNextSeed` matches what the engine will actually emit next. The caller keeps
 * fast-forward-closed streams out via the report's terminal flag; the reconstruction's own
 * terminal check below covers the remaining path — a row adopted mid-stream whose confirmed head
 * already sits on a terminal checkpoint — skipping the attach rather than installing a simulation
 * with nothing left to submit.
 */
async function applyFastForwardAttach(
  context: WorkerContext,
  report: FastForwardReport,
): Promise<void> {
  const input = buildSimulationInput(report.activity, {
    failureAction: context.getFailureAction(),
  });

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

function emitFailureActionStatus(
  context: WorkerContext,
  failureAction: ActivityFailureAction,
): void {
  const message = createFailureActionStatusMessage(failureAction);

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}

function emitCapStatus(context: WorkerContext, remainingMs: number, halted: boolean): void {
  const message = createOfflineCapStatusMessage(remainingMs, halted);

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}

function emitConnectionStatus(context: WorkerContext, online: boolean): void {
  const message = createConnectionStatusMessage(online);

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}
