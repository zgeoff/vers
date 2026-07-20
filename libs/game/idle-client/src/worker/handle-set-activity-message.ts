import { buildSimulationInput } from '@vers/idle-core';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import type { SetActivityMessage } from '../types';
import type { WorkerContext } from './types';

export async function handleSetActivityMessage(
  context: WorkerContext,
  message: SetActivityMessage,
): Promise<void> {
  const simulation = context.getSimulation();

  const input = buildSimulationInput(message.activity, {
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
