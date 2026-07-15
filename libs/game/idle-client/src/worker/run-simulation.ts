import type { Simulation } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';
import { createOfflineCapStatusMessage } from './create-offline-cap-status-message';
import { OFFLINE_CAP_WARNING_MS } from './offline-cap-warning-ms';
import { pickPostTerminalAction } from './pick-post-terminal-action';
import { runContinuation } from './run-continuation';
import type { WorkerContext } from './types';

/**
 * Advances the simulation one tick, submits any checkpoint it yields, and resolves what follows a
 * terminal one: stop on an aborted failure, halt at the boundary when the offline-progress budget
 * is spent — the simulation idles on its last state, and connected tabs learn via the cap-status
 * broadcast — or restart into the next attempt. Cap status is also broadcast while the remaining
 * budget is inside the warning window, so tabs can warn before the halt lands.
 */
export async function runSimulation(
  context: WorkerContext,
  simulation: Simulation,
  timestep: number,
) {
  const activityID = simulation.activity?.id;

  if (activityID === undefined) {
    return;
  }

  const checkpoint = await simulation.run(timestep);

  if (!checkpoint) {
    return;
  }

  await context.getSubmitter().submit(activityID, checkpoint);

  const isTerminal =
    checkpoint.type === ActivityCheckpointType.Completed ||
    checkpoint.type === ActivityCheckpointType.Failed;

  if (!isTerminal) {
    return;
  }

  const remainingBudgetMs = context.getRemainingBudgetMs();

  const action = pickPostTerminalAction({
    checkpointType: checkpoint.type,
    failureAction: simulation.failureAction,
    remainingBudgetMs,
  });

  if (action === 'stop') {
    await simulation.stopActivity();

    return;
  }

  if (action === 'halt-at-boundary') {
    emitCapStatus(context, 0, true);

    return;
  }

  if (remainingBudgetMs <= OFFLINE_CAP_WARNING_MS) {
    emitCapStatus(context, remainingBudgetMs, false);
  }

  const activity = context.getActivity();

  // A SetActivity or resync that landed while the terminal batch was awaited owns the runtime
  // now — starting a continuation for this stale row would overwrite its activity and scope.
  if (context.getSimulation() !== simulation || activity?.id !== activityID) {
    return;
  }

  await runContinuation(context, simulation, activity);
}

function emitCapStatus(context: WorkerContext, remainingMs: number, halted: boolean) {
  const message = createOfflineCapStatusMessage(remainingMs, halted);

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}
