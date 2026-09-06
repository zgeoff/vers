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
import { readActivityStart } from '../submission/read-activity-start';
import { readFailureActionCache } from '../submission/read-failure-action-cache';
import { readLastStartedActivity } from '../submission/read-last-started-activity';
import { sweepStaleCheckpoints } from '../submission/sweep-stale-checkpoints';
import type { ActivitySubmissionContext } from '../submission/types';
import { writeFailureActionCache } from '../submission/write-failure-action-cache';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
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

export async function runResyncFlow(
  context: WorkerContext,
  avatarID: string,
  claim: boolean,
  signals: Readonly<FlowSignals>,
): Promise<void> {
  const heldActivity = context.getActivity();

  // the held activity is stale client state: a run can end server-side and the account switch
  // avatars while this worker still holds the old row, so reset before installing anything for
  // the new avatar
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
      // a dirty value is flushed only when it was set for this avatar; otherwise the server's value
      // wins and the cache is rewritten clean, so a leftover from another avatar never reaches the
      // wrong row
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
  await updateLatestRunRecords(context, result);

  return result;
}

function toActivityFailureAction(failureAction: ContractFailureAction): ActivityFailureAction {
  return failureAction === 'retry' ? ActivityFailureAction.Retry : ActivityFailureAction.Abort;
}

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

  // the closed row's tallies already persisted, so an avatar switch resolves as a normal outcome;
  // the stamped resync avatar clears too, or the next connectivity proof would resync this same
  // dead avatar again
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
  readonly skipTerminalHead: boolean;
}

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

    context.setLatestRun({
      activityID: activity.id,
      avatarID: activity.avatarID,
      baselineXP: activity.buildSnapshot.xp,
      deltaXP: 0,
      tail: null,
    });

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

  const reconstructed = reconstruction.simulation.activity;

  invariant(reconstructed !== null, 'a reconstruction that reached its target holds its activity');

  // the replayed prefix never passes through the live tick, so the next mint's xp fold is seeded
  // from it here — the live ticks that follow carry the record forward
  context.setLatestRun({
    activityID: activity.id,
    avatarID: activity.avatarID,
    baselineXP: activity.buildSnapshot.xp,
    deltaXP: reconstructed.rewards.xp,
    tail: reconstruction.lastCheckpoint,
  });

  await context.getSubmitter().registerActivity({
    ...submission,
    previousNextSeed: reconstruction.lastCheckpoint.nextSeed,
  });

  await setLiveSimulationOrStopBack(context, activity, reconstruction.simulation, signals);
}

interface FetchedBaseline {
  readonly activity: ActivityData;
  readonly xp: number;
}

// A worker with no later run of its own adopts the server's latest row as the next mint's fold
// source and predecessor: a fresh device, or one whose previous run the server closed, otherwise
// mints from xp 0 with no predecessor and is refused.
async function updateLatestRunRecords(
  context: WorkerContext,
  result: Readonly<ResyncResult>,
): Promise<void> {
  const fetched = pickFetchedBaseline(result);

  if (fetched === null || context.getActivity()?.id === fetched.activity.id) {
    return;
  }

  const activity = fetched.activity;
  const held = context.getLatestRun();
  const heldID = held !== null && held.avatarID === activity.avatarID ? held.activityID : undefined;

  if (!(await isRecordAhead(heldID, activity.id))) {
    context.setLatestRun({
      activityID: activity.id,
      avatarID: activity.avatarID,
      baselineXP: fetched.xp,
      deltaXP: 0,
      tail: null,
    });
  }

  const lastStarted = await readLastStartedActivity(activity.avatarID);

  if (!(await isRecordAhead(lastStarted?.lastActivityID, activity.id))) {
    await writeLastStartedActivity({ avatarID: activity.avatarID, lastActivityID: activity.id });
  }
}

function pickFetchedBaseline(result: Readonly<ResyncResult>): FetchedBaseline | null {
  const report = result.report;

  if (report !== undefined) {
    if (report.reason === 'displaced' || report.reason === 'avatar-switched') {
      return null;
    }

    // a gap that minted continuations leaves the final mint as the latest row, and its snapshot
    // is the server's fold at that mint with nothing appended past it
    if (report.attempts > 0) {
      return { activity: report.activity, xp: report.activity.buildSnapshot.xp };
    }
  }

  if (result.progress === null) {
    return null;
  }

  return { activity: result.progress.activity, xp: result.progress.optimisticBuild.xp };
}

async function isRecordAhead(recordedID: string | undefined, fetchedID: string): Promise<boolean> {
  if (recordedID === undefined) {
    return false;
  }

  if (recordedID === fetchedID) {
    return true;
  }

  // a start still in the durable store was minted here and has not reached the server, so it
  // succeeds the fetched row rather than preceding it
  return (await readActivityStart(recordedID)) !== undefined;
}

function isTerminalCheckpoint(checkpoint: ActivityCheckpoint): boolean {
  return (
    checkpoint.type === ActivityCheckpointType.Completed ||
    checkpoint.type === ActivityCheckpointType.Failed
  );
}

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
