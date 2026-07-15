import { buildSimulationInput } from '@vers/idle-core';
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

  const input = buildSimulationInput(message.activity);

  await context.getSubmitter().registerActivity({
    activityID: message.activity.id,
    appendedHead: message.activity.appendedHead,
    lastHash: message.activity.lastHash,
    startChainIndex: message.activity.startChainIndex,
  });

  context.setActivity(message.activity);
  simulation.startActivity(input.avatar, input.activity);
}
