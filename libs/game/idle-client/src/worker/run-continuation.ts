import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { buildSimulationInput } from '@vers/idle-core';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import { writePendingStartIntent } from '../submission/write-pending-start-intent';
import { createConnectionStatusMessage } from './create-connection-status-message';
import { createRequestResyncMessage } from './create-request-resync-message';
import { hasStopIntervened } from './has-stop-intervened';
import { runResyncFlow } from './run-resync-flow';
import { submitStopIntent } from './submit-stop-intent';
import type { WorkerContext } from './types';

/**
 * Starts the next continuation after a terminal checkpoint. `simulation.restartActivity()` keeps
 * the same activity id, which the server has already closed to further appends on that terminal
 * checkpoint — an append onto it comes back `ACTIVITY_TERMINAL` and kills the stream. This instead
 * starts a fresh server row for the same scope, continuing the same RNG chain the terminal
 * checkpoint's `nextSeed` anchors (the new row's own seed, by the seed-chain identity), and
 * registers submission against that row from a zero cursor. A duplicate delivery of this same
 * start succeeds idempotently server-side with the row it minted, so a `CONFLICT` always means a
 * genuinely different claim on the avatar — every one is handed to a full resync, which
 * reconstructs the confirmed stream before attaching; adopting a conflicting row from a zero
 * cursor would fork the checkpoint chain. The same-row case — this row's terminal append still
 * unacknowledged — also records a durable start intent, so a later resync's entry drain starts
 * the next row itself once the terminal append lands, and a worker reload in between loses
 * nothing. A transport failure stops and uninstalls the simulation, records the same durable
 * intent, and reports the worker offline rather than retrying inline — the next reconnect resync
 * rebuilds from the server's confirmed state and honors the intent. Any other rejection also
 * stops and uninstalls the simulation, but without the offline signal or an intent record: the
 * service answered, so the failure is the activity's, not the connection's. The flow runs as a
 * lifecycle turn queued from the tick loop, so the entry guard is the staleness check: a queued
 * turn whose simulation/activity pair no longer owns the runtime — a stop or a fresher selection
 * ran while it waited — returns without touching anything. Past the start call only stops can
 * interleave, and every path re-checks the stop epoch: a row this continuation itself started
 * under a stop is stopped back durably, and no intent is recorded for a run that no longer
 * exists.
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
      await writeStartIntent(context, activity, entryEpoch);
    }

    await stopAndUninstall(context, simulation);

    // called inner-to-inner: this flow already holds the mailbox turn, and queueing a resync
    // behind itself would deadlock
    await runResyncFlow(context, createRequestResyncMessage(row.avatarID), entryEpoch);

    return;
  }

  await stopAndUninstall(context, simulation);

  if (!isDefinedError(error)) {
    if (!hasStopIntervened(context, entryEpoch)) {
      await writeStartIntent(context, activity, entryEpoch);
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
 * Stops this continuation's own simulation and uninstalls it — but only while it still owns the
 * runtime; a stop or a fresher selection may have installed a replacement this must not evict.
 */
async function stopAndUninstall(context: WorkerContext, simulation: Simulation): Promise<void> {
  await simulation.stopActivity();

  if (context.getSimulation() === simulation) {
    context.setSimulation(null);
  }
}

/**
 * Records the durable start intent, then re-checks the stop epoch and compensates: the caller's
 * pre-write guard is a synchronous check, and a stop — always concurrent with lifecycle flows —
 * can land and run its own unconditional intent removal in the gap before this write's
 * transaction commits. Readwrite transactions on the store run in creation order, so a
 * compensating remove issued after the write settles is ordered after the stop's removal — a
 * ghost intent can never survive to revive the run the player just ended.
 */
async function writeStartIntent(
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
