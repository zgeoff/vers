import { isDefinedError } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { buildSimulationInput } from '@vers/idle-core';
import { loadContentDocument } from '../content/load-content-document';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
import { writePendingStartIntent } from '../submission/write-pending-start-intent';
import { WorkerMessageType } from '../types';
import { resetSimulation } from './reset-simulation';
import { runResyncFlow } from './run-resync-flow';
import { submitStopIntent } from './submit-stop-intent';
import { tryStartActivity } from './try-start-activity';
import type { FlowSignals, WorkerContext } from './types';

/**
 * Starts the next continuation after a terminal checkpoint: a fresh server row for the same
 * scope, continuing the seed chain the terminal checkpoint's `nextSeed` anchors, registered from
 * a zero cursor. Restarting the same row is impossible — the server closed it to appends on the
 * terminal checkpoint.
 *
 * Duplicate deliveries dedupe on the start key, so a `CONFLICT` is a genuinely different claim
 * and is handed to a full resync — adopting a conflicting row from a zero cursor would fork the
 * checkpoint stream. The same-row case (a terminal append still unacknowledged) and a transport
 * failure both park a durable start intent for a later resync's drain, surviving a worker reload.
 * Any other rejection parks nothing — the service answered, so the failure is the activity's, not
 * the connection's. Two of those rejections also notify the tab, which would otherwise be left on
 * a silently reset runtime: `AVATAR_NOT_ACTIVE` names the avatar the account switched to
 * mid-session, and an expired sim version has the tab offer a reload — the only remedy once this
 * build's engine can no longer replay the current content.
 *
 * Queued from the tick loop, the entry guard is the staleness check: a turn whose
 * simulation/activity pair lost the runtime while it waited returns untouched. Past the start
 * call only stops can interleave; a row started under one is stopped back durably.
 */
export async function runContinuation(
  context: WorkerContext,
  simulation: Simulation,
  activity: Readonly<ActivityData>,
): Promise<void> {
  if (context.getSimulation() !== simulation || context.getActivity()?.id !== activity.id) {
    return;
  }

  const signals: FlowSignals = { cancel: context.getCancelSignal(), stop: context.getStopSignal() };

  // Keyed by the terminal row it succeeds: a retried delivery dedupes onto the first attempt's
  // row, while the next continuation carries a new key and conflicts as a distinct intent.
  const [error, started] = await tryStartActivity(context, {
    avatarID: activity.avatarID,
    predecessorActivityID: activity.id,
    scopeID: activity.scopeID,
    scopeType: activity.scopeType,
    startKey: `continue_${activity.id}`,
  });

  if (error === null) {
    // durable so the row's own predecessor reference stays recoverable across a worker reload,
    // regardless of what the stop-signal check below does with the row itself
    await writeLastStartedActivity({ avatarID: started.avatarID, lastActivityID: started.id });

    if (signals.stop.aborted) {
      await submitStopIntent(context, started);

      return;
    }

    await startContinuationFrom(context, simulation, started, signals);

    return;
  }

  if (isDefinedError(error) && error.code === 'CONFLICT') {
    const row = error.data.activity;

    if (row.id === activity.id && !signals.stop.aborted) {
      await parkContinuation(activity, signals);
    }

    stopAndReset(context, simulation);

    // an inner sub-flow, run within this flow's own active turn rather than sent as a new event —
    // only a public entry point sends the lifecycle actor an event. An automatic continuation never
    // claims the writer — the conflicting row may be another device's live run
    await runResyncFlow(context, row.avatarID, false, signals);

    return;
  }

  if (isDefinedError(error) && error.code === 'AVATAR_NOT_ACTIVE') {
    stopAndReset(context, simulation);

    context.broadcast({
      status: {
        activeAvatarName: error.data.activeAvatarName,
        attempts: 0,
        kind: 'avatar-switched',
        levelUps: 0,
      },
      type: WorkerMessageType.ResyncStatus,
    });

    return;
  }

  // expired means the service confirmed this build's engine can't replay the current content —
  // only a reload delivers a newer one, and nothing is parked: the bundled engine that would
  // replay the intent is the one refused
  if (isDefinedError(error) && error.code === 'SIM_VERSION_EXPIRED') {
    stopAndReset(context, simulation);

    context.broadcast({
      status: { kind: 'sim-version-expired' },
      type: WorkerMessageType.ResyncStatus,
    });

    return;
  }

  stopAndReset(context, simulation);

  if (!isDefinedError(error)) {
    if (!signals.stop.aborted) {
      await parkContinuation(activity, signals);
    }

    context.updateConnectivity(false);
  }
}

async function startContinuationFrom(
  context: WorkerContext,
  simulation: Simulation,
  row: Readonly<ActivityData>,
  signals: Readonly<FlowSignals>,
): Promise<void> {
  const document = await loadContentDocument(
    context.getClient(),
    row.contentVersion,
    signals.cancel,
  );

  // the signal only cancels the load's fetch — a cached document resolves without consulting it,
  // so a stop that landed during the load is re-checked here: installing would revive the run the
  // player just ended, and the minted row is stopped back durably, as any player stop delivers
  if (signals.stop.aborted) {
    await submitStopIntent(context, row);

    return;
  }

  const input = buildSimulationInput(document.encounter, row, {
    failureAction: context.getFailureAction(),
  });

  simulation.startActivity(input.avatar, input.activity);
  context.setActivity(row);

  await context.getSubmitter().registerActivity({
    activityID: row.id,
    appendedHead: 0,
    avatarID: row.avatarID,
    lastHash: row.startHash,
    scopeID: row.scopeID,
    startChainIndex: row.startChainIndex,
  });
}

/**
 * Stops this continuation's own simulation and resets the runtime to idle — but only while it
 * still owns the runtime; a concurrent stop may have installed its own replacement, which must
 * not be evicted.
 */
function stopAndReset(context: WorkerContext, simulation: Simulation): void {
  simulation.stopActivity();

  if (context.getSimulation() === simulation) {
    resetSimulation(context);
  }
}

/**
 * Parks the durable start intent, then re-checks the stop signal and compensates: a stop can land
 * its own unconditional removal in the gap before this write's transaction commits. Readwrite
 * transactions on the store run in creation order, so the compensating remove is ordered after
 * the stop's — a ghost intent never survives to revive the run the player ended.
 */
async function parkContinuation(
  activity: Readonly<ActivityData>,
  signals: Readonly<FlowSignals>,
): Promise<void> {
  await writePendingStartIntent({
    activityID: activity.id,
    avatarID: activity.avatarID,
    scopeID: activity.scopeID,
    scopeType: activity.scopeType,
  });

  if (signals.stop.aborted) {
    await removePendingStartIntent(activity.id);
  }
}
