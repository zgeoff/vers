import type { ActivityData } from '@vers/contract-activity';
import { buildSimulationInput } from '@vers/idle-core';
import { loadContentDocument } from '../content/load-content-document';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import type { WorkerContext } from './types';

interface SetActivityMessage {
  readonly activity: ActivityData;
}

export async function handleSetActivityMessage(
  context: WorkerContext,
  message: SetActivityMessage,
): Promise<void> {
  const simulation = context.getSimulation();
  const cancel = context.getCancelSignal();

  const document = await loadContentDocument(
    context.getClient(),
    message.activity.contentVersion,
    cancel,
  );

  // the signal only cancels the load's fetch — a cached document resolves without consulting it,
  // so a stop or shutdown that landed during the load is re-checked here before anything installs
  cancel.throwIfAborted();

  const input = buildSimulationInput(document.encounter, message.activity, {
    failureAction: context.getFailureAction(),
  });

  // The registration starts before the activity installs but is awaited only after, so the
  // simulation is live from the first tick while the submitter still holds any checkpoint until
  // the seeding resolves.
  const registration = context.getSubmitter().registerActivity({
    activityID: message.activity.id,
    appendedHead: message.activity.appendedHead,
    lastHash: message.activity.lastHash,
    startChainIndex: message.activity.startChainIndex,
  });

  context.setActivity(message.activity);
  simulation.startActivity(input.avatar, input.activity);

  await registration;

  // unconditional: the fresher selection supersedes whatever continuation was outstanding
  await removePendingStartIntent();
}
