import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { buildSimulationInput } from '@vers/idle-core';
import { createConnectionStatusMessage } from './create-connection-status-message';
import type { WorkerContext } from './types';

/**
 * Starts the next continuation after a terminal checkpoint. `simulation.restartActivity()` keeps
 * the same activity id, which the server has already closed to further appends on that terminal
 * checkpoint — an append onto it comes back `ACTIVITY_TERMINAL` and kills the stream. This instead
 * starts a fresh server row for the same scope, continuing the same RNG chain the terminal
 * checkpoint's `nextSeed` anchors (the new row's own seed, by the seed-chain identity), and
 * registers submission against that row from a zero cursor. A transport failure stops the
 * simulation and reports the worker offline rather than retrying inline — the next reconnect
 * resync rebuilds from the server's confirmed state.
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

  if (error !== null) {
    if (isDefinedError(error) && error.code === 'CONFLICT') {
      await startContinuationFrom(context, simulation, error.data.activity);

      return;
    }

    await simulation.stopActivity();

    emitConnectionStatus(context, false);

    return;
  }

  await startContinuationFrom(context, simulation, started);
}

async function startContinuationFrom(
  context: WorkerContext,
  simulation: Simulation,
  row: Readonly<ActivityData>,
): Promise<void> {
  const input = buildSimulationInput(row, { failureAction: simulation.failureAction });

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
