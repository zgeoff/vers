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
import { loadContentDocument } from '../content/load-content-document';
import { runReconstruction } from '../resync/run-reconstruction';
import { runResync } from '../resync/run-resync';
import type { FastForwardReport, ResyncPlan, ResyncResult } from '../resync/types';
import { readFailureActionCache } from '../submission/read-failure-action-cache';
import { sweepStaleCheckpoints } from '../submission/sweep-stale-checkpoints';
import type { ActivitySubmissionContext } from '../submission/types';
import { writeFailureActionCache } from '../submission/write-failure-action-cache';
import { WorkerMessageType } from '../types';
import { flushPendingStop } from './flush-pending-stop';
import { isAbortError } from './is-abort-error';
import { registerSimulationListeners } from './register-simulation-listeners';
import { reportWorkerFault } from './report-worker-fault';
import { resetSimulation } from './reset-simulation';
import { submitStopIntent } from './submit-stop-intent';
import type { FlowSignals, WorkerContext } from './types';
import { updateWriterDisplacedStatus } from './update-writer-displaced-status';
import type { ResyncStatus } from './worker-to-client-message-schema';

/**
 * Runs one resync end to end — the data-plane body a public entry point reaches only through the
 * lifecycle actor's queue. Every install re-checks `signals.stop`, the caller's entry-captured stop
 * signal, so a stop raised after the caller began — including during a queue wait — aborts the
 * install; the cancel composite additionally cancels in-flight reads on a worker shutdown.
 *
 * Only a plan covering a real away period broadcasts a `ResyncStatus` progression ending on
 * `done` or `capped`, so a tab's welcome-back UI always resolves. Zero-gap outcomes stay silent,
 * so a fresh login never opens it.
 *
 * An outright failure reports the fault and broadcasts `failed` — never a connection-status
 * change — and never rejects; a tab's retry re-signals it. `UNAUTHORIZED` broadcasts
 * `session-expired` instead, with no fault report: the only remedy is a fresh sign-in, so the tab
 * renders that rather than a futile retry. An abort settles silently — broadcasting `failed`
 * would flash an error for a deliberate stop.
 */
export async function runResyncFlow(
  context: WorkerContext,
  avatarID: string,
  claim: boolean,
  signals: Readonly<FlowSignals>,
): Promise<void> {
  const heldActivity = context.getActivity();

  // The worker's held activity is stale client state, not a live server row: once a run ends
  // server-side — capped by a checkpoint submission that exhausted its offline budget, stopped
  // from another tab, rejected by the verifier, or parked by replay's dispatch — the account may
  // legitimately switch avatars while this worker still holds the old row, and the next resync
  // for the new avatar lands here. Never install on top of it — reset first so no snapshot of the
  // old avatar outlives the switch.
  if (heldActivity !== null && heldActivity.avatarID !== avatarID) {
    resetSimulation(context);
  }

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

    await runResyncPass(context, avatarID, claim, signals);
  } catch (error) {
    if (isAbortError(error, signals.cancel)) {
      return;
    }

    if (error instanceof ORPCError && error.code === 'UNAUTHORIZED') {
      emitResyncStatus(context, { avatarID, kind: 'session-expired' });
    } else {
      reportWorkerFault('resync', error);
      emitResyncStatus(context, { avatarID, kind: 'failed' });
    }
  }
}

/**
 * One full fetch → plan → sweep → apply pass.
 */
async function runResyncPass(
  context: WorkerContext,
  avatarID: string,
  claim: boolean,
  signals: Readonly<FlowSignals>,
): Promise<ResyncResult> {
  const result = await runResync({
    avatarID,
    buildSimulationInput: async (source) => {
      const document = await loadContentDocument(
        context.getClient(),
        source.contentVersion,
        signals.cancel,
      );

      return buildSimulationInput(document.encounter, source, {
        failureAction: context.getFailureAction(),
      });
    },
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
        await flushFailureAction(context, avatarID, signals.cancel);

        return;
      }

      await updateFailureActionFromServer(
        context,
        avatarID,
        toActivityFailureAction(progress.failureAction),
      );
    },
    signal: signals.cancel,
    submitter: context.getSubmitter(),
  });

  try {
    await sweepStaleCheckpoints(pickKeepActivityIDs(context, result));
  } catch (error) {
    // a stranded row costs nothing but disk until the next sweep
    reportWorkerFault('resync', error);
  }

  await applyResyncResult(context, result, signals);

  return result;
}

function toActivityFailureAction(failureAction: ContractFailureAction): ActivityFailureAction {
  return failureAction === 'retry' ? ActivityFailureAction.Retry : ActivityFailureAction.Abort;
}

/**
 * Delivers a dirty local failure-action value to the server as the offline outbox's one entry:
 * best-effort, so a delivery failure leaves it dirty for the next resync's reconcile to retry.
 */
async function flushFailureAction(
  context: WorkerContext,
  avatarID: string,
  cancelSignal: AbortSignal,
): Promise<void> {
  const failureAction = context.getFailureAction();

  const [error] = await safe(
    context.getClient().updateFailureAction({ avatarID, failureAction }, { signal: cancelSignal }),
  );

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
 * The activities whose queued checkpoints survive the post-resync sweep: the resync's determined
 * latest activity and whichever activity is live at sweep time (its queue is its running writer's
 * pipeline, never stranded work). Nothing else is worth keeping: a worker restart has no delivery
 * path for a stranded row and the server settles rewards authoritatively.
 */
function pickKeepActivityIDs(
  context: WorkerContext,
  result: Readonly<ResyncResult>,
): Array<string> {
  return [
    ...new Set(
      [pickLatestActivityID(result), context.getSimulation().activity?.id].filter(
        (activityID): activityID is string => activityID !== undefined,
      ),
    ),
  ];
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
  signals: Readonly<FlowSignals>,
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
    await applyFastForward(context, result.report, signals);

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
    await applyAttachLive(context, result.plan, result.progress, signals);
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
  signals: Readonly<FlowSignals>,
): Promise<void> {
  if (context.getSimulation().activity?.id === plan.context.activityID) {
    return;
  }

  invariant(
    progress !== null,
    'an attach-live plan always carries the progress it was decided from',
  );

  await applyHeadAttach(context, progress.activity, plan.context, signals, {
    skipTerminalHead: false,
  });
}

async function applyFastForward(
  context: WorkerContext,
  report: FastForwardReport,
  signals: Readonly<FlowSignals>,
): Promise<void> {
  // The progression already broadcast `fast-forwarding`, so it must still resolve — with the
  // displaced outcome, not `done`, since the tallies past the confirmed head never persisted.
  if (report.reason === 'displaced') {
    applyActiveElsewhere(context, report.activity.id);
    emitResyncStatus(context, { activityID: report.activity.id, kind: 'active-elsewhere' });

    return;
  }

  // The account switched avatars between the closed row's terminal append and the next
  // continuation's start: the closed row's tallies already persisted, so this resolves rather
  // than reports a fault — the caller renders it as a normal outcome, not a failed catch-up. No
  // further fallback pass follows at this depth, so the stamped resync avatar clears here too —
  // otherwise the next connectivity proof would resync this same dead avatar again.
  if (report.reason === 'avatar-switched') {
    resetSimulation(context);

    context.setResyncAvatarID(null);

    emitResyncStatus(context, {
      activeAvatarName: report.activeAvatarName,
      attempts: report.attempts,
      kind: 'avatar-switched',
      levelUps: report.levelUps,
    });

    return;
  }

  if (report.finalRowTerminal) {
    // The plan's abort policy mints its final continuation's row exactly like any other, but the
    // policy's online counterpart never starts a successor — stop this row back durably so the
    // gap reads idle server-side, instead of sitting active for the next resync to revive.
    await submitStopIntent(context, report.activity);
  } else if (report.activity.status === 'active') {
    await applyHeadAttach(
      context,
      report.activity,
      {
        activityID: report.activity.id,
        appendedHead: report.appendedHead,
        lastHash: report.activity.lastHash,
        startChainIndex: report.activity.startChainIndex,
      },
      signals,
      { skipTerminalHead: true },
    );
  }

  emitResyncStatus(context, {
    attempts: report.attempts,
    kind: 'done',
    levelUps: report.levelUps,
  });
}

interface HeadAttachOptions {
  /**
   * Skip the attach when the reconstructed head is itself a terminal checkpoint — a row adopted
   * mid-stream with nothing left to submit.
   */
  readonly skipTerminalHead: boolean;
}

/**
 * Attaches an activity live, chained onto the confirmed head the submission context names: a
 * zero head starts a checkpoint-0 simulation, a nonzero head reconstructs to the head first so
 * the registered cursor's `previousNextSeed` matches what the engine emits next. A reconstruction
 * divergence broadcasts the invalid stream and attaches nothing.
 */
async function applyHeadAttach(
  context: WorkerContext,
  activity: Readonly<ActivityData>,
  submission: Readonly<ActivitySubmissionContext>,
  signals: Readonly<FlowSignals>,
  options: HeadAttachOptions,
): Promise<void> {
  const document = await loadContentDocument(
    context.getClient(),
    activity.contentVersion,
    signals.cancel,
  );

  const input = buildSimulationInput(document.encounter, activity, {
    failureAction: context.getFailureAction(),
  });

  if (submission.appendedHead === 0) {
    await context.getSubmitter().registerActivity(submission);

    const simulation = createSimulation();

    simulation.startActivity(input.avatar, input.activity);

    await setLiveSimulationOrStopBack(context, activity, simulation, signals);

    return;
  }

  const reconstruction = runReconstruction({
    activity: input.activity,
    appendedHead: submission.appendedHead,
    avatar: input.avatar,
  });

  if ('divergence' in reconstruction) {
    emitDivergence(context, activity.id);

    return;
  }

  if (options.skipTerminalHead && isTerminalCheckpoint(reconstruction.lastCheckpoint)) {
    return;
  }

  await context.getSubmitter().registerActivity({
    ...submission,
    previousNextSeed: reconstruction.lastCheckpoint.nextSeed,
  });

  await setLiveSimulationOrStopBack(context, activity, reconstruction.simulation, signals);
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
  signals: Readonly<FlowSignals>,
): Promise<void> {
  if (signals.stop.aborted) {
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
  context.broadcast({ status, type: WorkerMessageType.ResyncStatus });
}

function emitDivergence(context: WorkerContext, activityID: string): void {
  reportWorkerFault(
    'checkpoint-stream',
    new Error(`checkpoint stream rejected for activity ${activityID}: reconstruction-divergence`),
  );

  context.broadcast({ activityID, type: WorkerMessageType.CheckpointStreamInvalid });
}

function emitFailureActionStatus(
  context: WorkerContext,
  failureAction: ActivityFailureAction,
): void {
  context.broadcast({ failureAction, type: WorkerMessageType.FailureActionStatus });
}
