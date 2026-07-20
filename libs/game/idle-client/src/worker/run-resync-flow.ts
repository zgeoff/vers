import { ORPCError, safe } from '@orpc/client';
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
import { readPendingStartIntent } from '../submission/read-pending-start-intent';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import { sweepStaleCheckpoints } from '../submission/sweep-stale-checkpoints';
import { writeFailureActionCache } from '../submission/write-failure-action-cache';
import type { ResyncStatus } from '../types';
import { createCheckpointStreamInvalidMessage } from './create-checkpoint-stream-invalid-message';
import { createFailureActionStatusMessage } from './create-failure-action-status-message';
import { createOfflineCapStatusMessage } from './create-offline-cap-status-message';
import { createResyncStatusMessage } from './create-resync-status-message';
import type { PendingStartFlushResult } from './flush-pending-start';
import { flushPendingStart } from './flush-pending-start';
import { flushPendingStop } from './flush-pending-stop';
import { hasStopIntervened } from './has-stop-intervened';
import { registerSimulationListeners } from './register-simulation-listeners';
import { reportWorkerFault } from './report-worker-fault';
import { resetSimulation } from './reset-simulation';
import { submitStopIntent } from './submit-stop-intent';
import type { WorkerContext } from './types';
import { updateWriterDisplacedStatus } from './update-writer-displaced-status';

/**
 * Runs one resync end to end — the mailbox-inner body: the reconnect recovery queues it as a
 * turn, while the start flow and continuations call it directly from inside their own turns
 * (queueing there would deadlock). Every install re-checks `entryEpoch`, the caller's stop-epoch
 * capture, so a stop raised after the caller began — including during a queue wait — aborts the
 * install. Only a plan covering a real away period broadcasts a `ResyncStatus` progression ending
 * on `done` or `capped`, so a tab's welcome-back UI always resolves; zero-gap outcomes stay
 * silent so a fresh login never opens it. An outright failure reports the fault and broadcasts
 * `failed`, never a connection-status change, and never rejects — a tab's retry re-signals it.
 * `UNAUTHORIZED` broadcasts `session-expired` instead, with no fault report: the only remedy is
 * a fresh sign-in, so the tab renders that rather than a futile retry.
 */
export async function runResyncFlow(
  context: WorkerContext,
  avatarID: string,
  claim: boolean,
  entryEpoch: number,
): Promise<void> {
  context.setResyncAvatarID(avatarID);

  try {
    // Held batches must land before the progress fetch, or the resync plans against an appended
    // head those checkpoints are still about to advance.
    await context.getSubmitter().flushHeld();

    // An undelivered stop gates the whole resync: until the server row reads closed, the progress
    // fetch would find it active and plan a catch-up for a run the player already ended.
    if ((await flushPendingStop(context)) === 'undelivered') {
      emitResyncStatus(context, { avatarID, kind: 'failed' });

      return;
    }

    // The held continuation-start intent delivers before planning, so the progress fetch finds
    // the row it minted and the plan attaches it. Offline is the only entry-time signal; every
    // other outcome resolves after the pass, once fetched progress can tell a live intent from a
    // stale one.
    const startFlush = await flushPendingStart(context, entryEpoch, avatarID);

    if (startFlush.outcome === 'undelivered') {
      context.updateConnectivity(false);
    }

    const result = await runResyncPass(context, avatarID, claim, entryEpoch);

    await applyStartFlush(context, avatarID, claim, entryEpoch, startFlush, result);
  } catch (error) {
    if (error instanceof ORPCError && error.code === 'UNAUTHORIZED') {
      emitResyncStatus(context, { avatarID, kind: 'session-expired' });
    } else {
      reportWorkerFault('resync', error);
      emitResyncStatus(context, { avatarID, kind: 'failed' });
    }
  }
}

/**
 * One full fetch → plan → sweep → apply pass. Split out so a delivered start intent can trigger a
 * single bounded second pass that attaches the row the delivery minted.
 */
async function runResyncPass(
  context: WorkerContext,
  avatarID: string,
  claim: boolean,
  entryEpoch: number,
): Promise<ResyncResult> {
  const result = await runResync({
    avatarID,
    buildSimulationInput: (activity) =>
      buildSimulationInput(activity, { failureAction: context.getFailureAction() }),
    claimWriter: claim,
    client: context.getClient(),
    isActivityLive: (activityID) => context.getSimulation().activity?.id === activityID,
    onWriterLost: (activityID) => {
      if (context.getActivity()?.id === activityID) {
        resetSimulation(context);
      }
    },
    onProgress: (progress) => {
      emitResyncStatus(context, { ...progress, kind: 'fast-forwarding' });
    },
    onProgressFetched: async (progress) => {
      // The dirty local value is flushed only when the cached record was set for this avatar;
      // otherwise the server's value wins, and the cache is rewritten clean for this avatar so a
      // dirty value left over from a different avatar this worker drove earlier is discarded
      // rather than delivered to the wrong row.
      const cached = await readFailureActionCache();

      if (context.isFailureActionDirty() && cached?.avatarID === avatarID) {
        await flushFailureAction(context, avatarID);

        return;
      }

      await updateFailureActionFromServer(
        context,
        avatarID,
        toActivityFailureAction(progress.failureAction),
      );
    },
    submitter: context.getSubmitter(),
  });

  await sweepStaleActivities(context, result);
  await applyResyncResult(context, result, entryEpoch);

  return result;
}

/**
 * Settles the entry drain's outcome now that fetched progress can adjudicate it. A delivered
 * row a stop kept from installing is stopped back. A `blocked` intent gets one retry — the
 * pass's own queued-checkpoint drain may have closed the source row — and a delivery there earns
 * one bounded second pass to attach the minted row. A `capped` intent broadcasts the cap halt
 * only while progress names its source row closed; a still-active source keeps silently, and any
 * other row clears the intent without a broadcast, which would otherwise repeat on every resync
 * forever.
 */
async function applyStartFlush(
  context: WorkerContext,
  avatarID: string,
  claim: boolean,
  entryEpoch: number,
  startFlush: Readonly<PendingStartFlushResult>,
  result: Readonly<ResyncResult>,
): Promise<void> {
  if (startFlush.outcome === 'delivered') {
    await stopBackUninstalledRow(context, startFlush.started, entryEpoch);

    return;
  }

  if (startFlush.outcome === 'blocked') {
    const retryFlush = await flushPendingStart(context, entryEpoch, avatarID);

    if (retryFlush.outcome === 'delivered') {
      await runResyncPass(context, avatarID, claim, entryEpoch);
      await stopBackUninstalledRow(context, retryFlush.started, entryEpoch);
    } else if (retryFlush.outcome === 'undelivered') {
      context.updateConnectivity(false);
    }

    return;
  }

  if (startFlush.outcome !== 'capped') {
    return;
  }

  const intent = await readPendingStartIntent();

  if (intent === undefined) {
    return;
  }

  const progressActivity = result.progress?.activity;

  if (progressActivity === undefined || progressActivity.id !== intent.activityID) {
    await removePendingStartIntent(intent.activityID);

    return;
  }

  if (progressActivity.status !== 'active') {
    emitCapStatus(context, 0, true);
  }
}

/**
 * Stops a drain-minted row back durably when a stop landed after its delivery and the pass never
 * installed it — active on the server with nothing local driving it, the next resync would
 * otherwise revive the run the player just ended.
 */
async function stopBackUninstalledRow(
  context: WorkerContext,
  started: Readonly<ActivityData>,
  entryEpoch: number,
): Promise<void> {
  if (!hasStopIntervened(context, entryEpoch)) {
    return;
  }

  if (context.getSimulation().activity?.id === started.id) {
    return;
  }

  await submitStopIntent(context, started);
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
 * Sweeps every queued checkpoint outside the resync's determined latest activity and whichever
 * activity is live at sweep time (its queue is its running writer's pipeline, never stranded
 * work). Nothing else is worth keeping: a worker restart has no delivery path for a stranded row
 * and the server settles rewards authoritatively. Failure only reports the fault — a stranded
 * row costs nothing but disk until the next sweep.
 */
async function sweepStaleActivities(
  context: WorkerContext,
  result: Readonly<ResyncResult>,
): Promise<Array<string>> {
  try {
    const keepActivityIDs = [
      ...new Set(
        [pickLatestActivityID(result), context.getSimulation().activity?.id].filter(
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

  if (result.plan.kind === 'active-elsewhere') {
    return result.plan.activityID;
  }

  return result.plan.context.activityID;
}

async function applyResyncResult(
  context: WorkerContext,
  result: Readonly<ResyncResult>,
  entryEpoch: number,
): Promise<void> {
  // A fetched row that is no longer active moots any recorded displacement for it: the run is
  // over, so neither a queued eviction settlement nor a lingering notice should tell the player
  // it continues elsewhere.
  const fetchedActivity = result.progress?.activity;

  if (fetchedActivity !== undefined && fetchedActivity.status !== 'active') {
    context.getSubmitter().removeEviction(fetchedActivity.id);

    if (context.getWriterDisplacedActivityID() === fetchedActivity.id) {
      updateWriterDisplacedStatus(context, null);
    }
  }

  if (result.report !== undefined) {
    await applyFastForward(context, result.report, entryEpoch);

    return;
  }

  if (result.plan.kind === 'rebase') {
    emitResyncStatus(context, { kind: 'capped' });

    return;
  }

  if (result.plan.kind === 'active-elsewhere') {
    applyActiveElsewhere(context, result.plan.activityID);

    return;
  }

  if (result.plan.kind === 'attach-live') {
    await applyAttachLive(context, result.plan, result.progress, entryEpoch);
  }
}

/**
 * Settles a displaced outcome: a still-live local simulation of the activity is cleared — its
 * appends are rejected, so leaving it ticking would show progress that never persists — and the
 * displacement is recorded and broadcast. No `ResyncStatus` accompanies it: no catch-up
 * progression started, so there is nothing to resolve.
 */
function applyActiveElsewhere(context: WorkerContext, activityID: string): void {
  if (context.getActivity()?.id === activityID) {
    resetSimulation(context);
  }

  updateWriterDisplacedStatus(context, activityID);
}

async function applyAttachLive(
  context: WorkerContext,
  plan: Extract<ResyncPlan, { kind: 'attach-live' }>,
  progress: ResyncResult['progress'],
  entryEpoch: number,
): Promise<void> {
  if (context.getSimulation().activity?.id === plan.context.activityID) {
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

    await setLiveSimulationOrStopBack(context, progress.activity, simulation, entryEpoch);

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

  await setLiveSimulationOrStopBack(
    context,
    progress.activity,
    reconstruction.simulation,
    entryEpoch,
  );
}

async function applyFastForward(
  context: WorkerContext,
  report: FastForwardReport,
  entryEpoch: number,
): Promise<void> {
  // The progression already broadcast `fast-forwarding`, so it must still resolve — with the
  // displaced outcome, not `done`, since the tallies past the confirmed head never persisted.
  if (report.reason === 'displaced') {
    applyActiveElsewhere(context, report.activity.id);
    emitResyncStatus(context, { activityID: report.activity.id, kind: 'active-elsewhere' });

    return;
  }

  if (report.activity.status === 'active' && !report.finalRowTerminal) {
    await applyFastForwardAttach(context, report, entryEpoch);
  }

  emitResyncStatus(context, {
    attempts: report.attempts,
    kind: 'done',
    levelUps: report.levelUps,
  });
}

/**
 * Attaches the fast-forward's final row live, chaining onto its confirmed head: a checkpoint-0
 * simulation when nothing is confirmed yet, otherwise one reconstructed to the head so the
 * registered cursor's `previousNextSeed` matches what the engine emits next. The caller filters
 * fast-forward-closed streams via the report's terminal flag; the reconstruction's terminal
 * check covers a row adopted mid-stream whose confirmed head is already terminal, skipping an
 * attach with nothing left to submit.
 */
async function applyFastForwardAttach(
  context: WorkerContext,
  report: FastForwardReport,
  entryEpoch: number,
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

    await setLiveSimulationOrStopBack(context, report.activity, simulation, entryEpoch);

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

  await setLiveSimulationOrStopBack(
    context,
    report.activity,
    reconstruction.simulation,
    entryEpoch,
  );
}

function isTerminalCheckpoint(checkpoint: ActivityCheckpoint): boolean {
  return (
    checkpoint.type === ActivityCheckpointType.Completed ||
    checkpoint.type === ActivityCheckpointType.Failed
  );
}

/**
 * Installs a resync's simulation as the live one, or stops the row back durably when a stop
 * landed after the caller's flow began: installing would revive the run the player just ended,
 * and leaving the row active with nothing local driving it would let the next resync revive it
 * instead. No fresher-activity guard remains: lifecycle flows are the only installers, and they
 * run one at a time.
 */
async function setLiveSimulationOrStopBack(
  context: WorkerContext,
  activity: Readonly<ActivityData>,
  simulation: Simulation,
  entryEpoch: number,
): Promise<void> {
  if (hasStopIntervened(context, entryEpoch)) {
    await submitStopIntent(context, activity);

    return;
  }

  context.setActivity(activity);
  context.setSimulation(simulation);

  registerSimulationListeners(context, simulation);

  // an install resolves any recorded displacement: this session either took the writer back or
  // moved on to a different run
  updateWriterDisplacedStatus(context, null);
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
