import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { buildSimulationInput } from '@vers/idle-core';
import { loadContentDocument } from '../content/load-content-document';
import { removeMintedActivityStart } from '../submission/remove-minted-activity-start';
import { loadActivityStart } from './load-activity-start';
import { resetSimulation } from './reset-simulation';
import type { FlowSignals, WorkerContext } from './types';

export async function runContinuation(
  context: WorkerContext,
  simulation: Simulation,
  activity: Readonly<ActivityData>,
): Promise<void> {
  if (context.getSimulation() !== simulation || context.getActivity()?.id !== activity.id) {
    return;
  }

  const signals: FlowSignals = { cancel: context.getCancelSignal(), stop: context.getStopSignal() };

  // Keyed by the terminal row it succeeds, so a row this flow already minted is recognisable to a
  // later recovery rather than delivered twice under two different keys.
  const row = await loadActivityStart(context, {
    avatarID: activity.avatarID,
    predecessorActivityID: activity.id,
    scopeID: activity.scopeID,
    scopeType: activity.scopeType,
    startKey: `continue_${activity.id}`,
  });

  if (row === null) {
    stopAndReset(context, simulation);

    return;
  }

  // written before install: a crash here still leaves a recoverable activity start for a later
  // reconcile
  await context.writeMintedActivityStart(row);

  if (signals.stop.aborted) {
    await removeMintedActivityStart(row);

    return;
  }

  // a shutdown aborts the cancel scope without aborting the stop scope, and a cached document
  // resolves without consulting either — so the install is guarded here rather than only inside it
  if (signals.cancel.aborted) {
    return;
  }

  try {
    await startContinuationFrom(context, simulation, row, signals);
  } catch (error) {
    // the cancel scope composes the stop scope, so a player stop cancels the content load and
    // throws out of the install; the minted row is discarded rather than left for a drain to
    // deliver, which would revive the run the player just ended
    if (!signals.stop.aborted) {
      throw error;
    }

    await removeMintedActivityStart(row);
  }
}

function stopAndReset(context: WorkerContext, simulation: Simulation): void {
  simulation.stopActivity();

  if (context.getSimulation() === simulation) {
    resetSimulation(context);
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

  // a cached document resolves without consulting the signal, so a stop that landed during the
  // load is re-checked here: installing would revive the run the player just ended
  if (signals.stop.aborted) {
    await removeMintedActivityStart(row);

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
