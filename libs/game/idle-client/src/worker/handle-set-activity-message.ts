import { buildSimulationInput } from '@vers/idle-core';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import type { SetActivityMessage } from '../types';
import type { WorkerContext } from './types';

export async function handleSetActivityMessage(
  context: WorkerContext,
  message: SetActivityMessage,
): Promise<void> {
  const simulation = context.getSimulation();

  if (!simulation) {
    console.warn('-- tried setting activity but no simulation');

    return;
  }

  const input = buildSimulationInput(message.activity, {
    failureAction: context.getFailureAction(),
  });

  // The registration starts before the activity installs but is awaited only after: installing
  // synchronously means a resync finishing during the seed read finds this fresher activity live
  // and yields to it, while the submitter still holds any checkpoint until the seeding resolves.
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
