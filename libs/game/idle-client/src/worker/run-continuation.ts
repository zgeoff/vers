import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { buildSimulationInput } from '@vers/idle-core';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import { writePendingStartIntent } from '../submission/write-pending-start-intent';
import { createConnectionStatusMessage } from './create-connection-status-message';
import { createRequestResyncMessage } from './create-request-resync-message';
import { hasStopIntervened } from './has-stop-intervened';
import { resetSimulation } from './reset-simulation';
import { runResyncFlow } from './run-resync-flow';
import { submitStopIntent } from './submit-stop-intent';
import type { WorkerContext } from './types';

/**
 * Starts the next continuation after a terminal checkpoint: a fresh server row for the same
 * scope, continuing the RNG chain the terminal checkpoint's `nextSeed` anchors, registered from
 * a zero cursor. Restarting the same row is impossible — the server closed it to appends on the
 * terminal checkpoint. Duplicate deliveries dedupe on the start key, so a `CONFLICT` is a
 * genuinely different claim and is handed to a full resync — adopting a conflicting row from a
 * zero cursor would fork the checkpoint chain. The same-row case (terminal append still
 * unacknowledged) and a transport failure both park a durable start intent for a later resync's
 * drain, surviving a worker reload; any other rejection parks nothing — the service answered, so
 * the failure is the activity's, not the connection's. Queued from the tick loop, the entry
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

  const entryEpoch = context.getStopEpoch();

  // keyed by the terminal row it succeeds: a retried delivery dedupes onto the first attempt's
  // row, while the next continuation carries a new key and conflicts as a distinct intent
  const [error, started] = await safe(
    context.getClient().startActivity({
      avatarID: activity.avatarID,
      scopeID: activity.scopeID,
      scopeType: activity.scopeType,
      startKey: `continue_${activity.id}`,
    }),
  );

  if (error === null) {
    if (hasStopIntervened(context, entryEpoch)) {
      await submitStopIntent(context, started);

      return;
    }

    await startContinuationFrom(context, simulation, started);

    return;
  }

  if (isDefinedError(error) && error.code === 'CONFLICT') {
    const row = error.data.activity;

    if (row.id === activity.id && !hasStopIntervened(context, entryEpoch)) {
      await parkContinuation(context, activity, entryEpoch);
    }

    await stopAndReset(context, simulation);

    // called inner-to-inner: this flow already holds the mailbox turn, and queueing a resync
    // behind itself would deadlock
    await runResyncFlow(context, createRequestResyncMessage(row.avatarID), entryEpoch);

    return;
  }

  await stopAndReset(context, simulation);

  if (!isDefinedError(error)) {
    if (!hasStopIntervened(context, entryEpoch)) {
      await parkContinuation(context, activity, entryEpoch);
    }

    emitConnectionStatus(context, false);
  }
}

async function startContinuationFrom(
  context: WorkerContext,
  simulation: Simulation,
  row: Readonly<ActivityData>,
): Promise<void> {
  const input = buildSimulationInput(row, { failureAction: context.getFailureAction() });

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
async function stopAndReset(context: WorkerContext, simulation: Simulation): Promise<void> {
  await simulation.stopActivity();

  if (context.getSimulation() === simulation) {
    resetSimulation(context);
  }
}

/**
 * Parks the durable start intent, then re-checks the stop epoch and compensates: a stop can land
 * its own unconditional removal in the gap before this write's transaction commits. Readwrite
 * transactions on the store run in creation order, so the compensating remove is ordered after
 * the stop's — a ghost intent never survives to revive the run the player ended.
 */
async function parkContinuation(
  context: WorkerContext,
  activity: Readonly<ActivityData>,
  entryEpoch: number,
): Promise<void> {
  await writePendingStartIntent({
    activityID: activity.id,
    avatarID: activity.avatarID,
    scopeID: activity.scopeID,
    scopeType: activity.scopeType,
  });

  if (hasStopIntervened(context, entryEpoch)) {
    await removePendingStartIntent(activity.id);
  }
}

function emitConnectionStatus(context: WorkerContext, online: boolean): void {
  const message = createConnectionStatusMessage(online);

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}
