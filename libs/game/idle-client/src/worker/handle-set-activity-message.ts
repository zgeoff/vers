import type { SetActivityMessage } from '../types';
import type { WorkerContext } from './types';

export async function handleSetActivityMessage(
  context: WorkerContext,
  message: SetActivityMessage,
) {
  const simulation = context.getSimulation();

  if (!simulation) {
    console.warn('-- tried setting activity but no simulation');

    return;
  }

  if (message.submission) {
    await context.getSubmitter().attach(message.submission);
  }

  simulation.startActivity(message.avatar, message.activity);
}
