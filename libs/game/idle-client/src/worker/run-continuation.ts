import { isDefinedError } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { buildSimulationInput } from '@vers/idle-core';
import { loadContentDocument } from '../content/load-content-document';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import { writePendingStartIntent } from '../submission/write-pending-start-intent';
import { WorkerMessageType } from '../types';
import { resetSimulation } from './reset-simulation';
import { runResyncFlow } from './run-resync-flow';
import { submitStopIntent } from './submit-stop-intent';
import { tryStartActivity } from './try-start-activity';
import type { FlowSignals, WorkerContext } from './types';

/**
 * Starts the next continuation after a terminal checkpoint: a fresh server row for the same
 * scope, continuing the RNG chain the terminal checkpoint's `nextSeed` anchors, registered from
 * a zero cursor. Restarting the same row is impossible — the server closed it to appends on the
 * terminal checkpoint. Duplicate deliveries dedupe on the start key, so a `CONFLICT` is a
 * genuinely different claim and is handed to a full resync — adopting a conflicting row from a
 * zero cursor would fork the checkpoint chain. The same-row case (terminal append still
 * unacknowledged) and a transport failure both park a durable start intent for a later resync's
 * drain, surviving a worker reload; any other rejection parks nothing — the service answered, so
 * the failure is the activity's, not the connection's. AVATAR_NOT_ACTIVE means the account
 * switched avatars mid-session: nothing is parked, since this avatar's chain has nowhere to
 * continue to, and the tab is told which avatar is now active rather than left on a silently
 * reset runtime. An expired sim version means this build's engine can no longer replay the
 * current content: nothing is parked, since a reload is the only remedy, and the tab is told to
 * offer it rather than left on a silently reset runtime. Queued from the tick loop, the entry
 * guard is the staleness check: a turn whose simulation/activity pair lost the runtime while it
 * waited returns untouched. Past the start call only stops can interleave; a row started under
 * one is stopped back durably.
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
    scopeID: activity.scopeID,
    scopeType: activity.scopeType,
    startKey: `continue_${activity.id}`,
  });

  if (error === null) {
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

    // called inner-to-inner: this flow already holds the mailbox turn, and queueing a resync
    // behind itself would deadlock. An automatic continuation never claims the writer — the
    // conflicting row may be another device's live run
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
    lastHash: row.startHash,
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
