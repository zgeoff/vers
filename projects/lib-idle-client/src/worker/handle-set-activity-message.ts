import type { SetActivityMessage } from '../types';
import type { WorkerContext } from './types';

export function handleSetActivityMessage(context: WorkerContext, message: SetActivityMessage) {
  const simulation = context.getSimulation();

  if (!simulation) {
    console.warn('-- tried setting activity but no simulation');

    return;
  }

  simulation.startActivity(message.avatar, message.activity);
}
