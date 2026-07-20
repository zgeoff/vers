import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { buildSimulationInput, createSimulation } from '@vers/idle-core';
import { writePendingStartIntent } from '../submission/write-pending-start-intent';
import { createConnectionStatusMessage } from './create-connection-status-message';
import { createRequestResyncMessage } from './create-request-resync-message';
import { runResyncFlow } from './handle-request-resync-message';
import { hasStopIntervened } from './has-stop-intervened';
import { registerSimulationListeners } from './register-simulation-listeners';
import { runOnLifecycleChain } from './run-on-lifecycle-chain';
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
 * unacknowledged — also records a pending continuation, so a resync that finds the row still
 * closed once the terminal append drains plans to start the next row itself rather than idling. A
 * transport failure stops and uninstalls the simulation, records the same pending continuation,
 * and reports the worker offline rather than
 * retrying inline — the next reconnect resync rebuilds from the server's confirmed state and
 * honors the pending intent. Any other rejection also stops and uninstalls the simulation, but
 * without the offline signal or a pending record: the service answered, so the failure is the
 * activity's, not the connection's. Every path past the start call re-checks the stop epoch and
 * the runtime's simulation/activity pair as they stood at entry — a stop or a fresher selection
 * that landed while the call was in flight owns the runtime now, so a row this continuation
 * itself started under a stop is stopped back durably, an adopted foreign row is left running but
 * not installed, and no pending continuation is recorded for a run that no longer exists.
 */
export async function runContinuation(
  context: WorkerContext,
  simulation: Simulation,
  activity: Readonly<ActivityData>,
): Promise<void> {
  await runOnLifecycleChain(context, 'continuation', () =>
    runContinuationFlow(context, simulation, activity),
  );
}

async function runContinuationFlow(
  context: WorkerContext,
  simulation: Simulation,
  activity: Readonly<ActivityData>,
): Promise<void> {
  const entryEpoch = context.getStopEpoch();

  // the chain serialized any queued lifecycle work behind this flow, but the runtime may already
  // have moved past the terminal row before this flow got its turn
  if (context.getSimulation() !== simulation || context.getActivity()?.id !== activity.id) {
    return;
  }

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
      await parkContinuation(activity);
    }

    await stopAndClear(context, simulation);
    await runResyncFlow(context, createRequestResyncMessage(row.avatarID));

    return;
  }

  await stopAndClear(context, simulation);

  if (!isDefinedError(error)) {
    if (!hasStopIntervened(context, entryEpoch)) {
      await parkContinuation(activity);
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
 * Stops this continuation's own simulation and clears the runtime to an empty replacement — but
 * only while it still owns the runtime; a stop may have installed a replacement this must not
 * evict. The stopped instance retains avatar and combat state, so it never stays installed.
 */
async function stopAndClear(context: WorkerContext, simulation: Simulation): Promise<void> {
  await simulation.stopActivity();

  if (context.getSimulation() === simulation) {
    const replacement = createSimulation();

    registerSimulationListeners(context, replacement);

    context.setSimulation(replacement);
    context.setActivity(null);
  }
}

/**
 * Sets this continuation aside as a durable start intent for a later reconnect or resync entry
 * to deliver.
 */
async function parkContinuation(activity: Readonly<ActivityData>): Promise<void> {
  await writePendingStartIntent({
    avatarID: activity.avatarID,
    scopeID: activity.scopeID,
    scopeType: activity.scopeType,
    startKey: `continue_${activity.id}`,
  });
}

function emitConnectionStatus(context: WorkerContext, online: boolean): void {
  const message = createConnectionStatusMessage(online);

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}
