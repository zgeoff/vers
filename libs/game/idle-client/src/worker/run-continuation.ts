import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { buildSimulationInput } from '@vers/idle-core';
import { createConnectionStatusMessage } from './create-connection-status-message';
import { createRequestResyncMessage } from './create-request-resync-message';
import { handleRequestResyncMessage } from './handle-request-resync-message';
import type { WorkerContext } from './types';

/**
 * Starts the next continuation after a terminal checkpoint. `simulation.restartActivity()` keeps
 * the same activity id, which the server has already closed to further appends on that terminal
 * checkpoint — an append onto it comes back `ACTIVITY_TERMINAL` and kills the stream. This instead
 * starts a fresh server row for the same scope, continuing the same RNG chain the terminal
 * checkpoint's `nextSeed` anchors (the new row's own seed, by the seed-chain identity), and
 * registers submission against that row from a zero cursor. A `CONFLICT` means a row is already
 * live for the avatar: a different, never-appended row is adopted directly from its start fields,
 * while a progressed row — or this same row, its terminal append still unacknowledged — is handed
 * to a full resync, which reconstructs its confirmed checkpoints before attaching; adopting either
 * from a zero cursor would fork the checkpoint chain. A transport failure stops and uninstalls the
 * simulation and reports the worker offline rather than retrying inline — the next reconnect
 * resync rebuilds from the server's confirmed state. Any other rejection also stops and uninstalls
 * the simulation, but without the offline signal: the service answered, so the failure is the
 * activity's, not the connection's.
 */
export async function runContinuation(
  context: WorkerContext,
  simulation: Simulation,
  activity: Readonly<ActivityData>,
): Promise<void> {
  const [error, started] = await safe(
    context.getClient().startActivity({
      avatarID: activity.avatarID,
      scopeID: activity.scopeID,
      scopeType: activity.scopeType,
    }),
  );

  if (error === null) {
    await startContinuationFrom(context, simulation, started);

    return;
  }

  if (isDefinedError(error) && error.code === 'CONFLICT') {
    const row = error.data.activity;

    if (row.appendedHead === 0 && row.id !== activity.id) {
      await startContinuationFrom(context, simulation, row);

      return;
    }

    await simulation.stopActivity();

    context.setSimulation(null);

    await handleRequestResyncMessage(context, createRequestResyncMessage(row.avatarID));

    return;
  }

  await simulation.stopActivity();

  context.setSimulation(null);

  if (!isDefinedError(error)) {
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

function emitConnectionStatus(context: WorkerContext, online: boolean): void {
  const message = createConnectionStatusMessage(online);

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}
