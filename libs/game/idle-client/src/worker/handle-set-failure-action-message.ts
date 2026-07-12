import type { SetFailureActionMessage } from '../types';
import type { WorkerContext } from './types';

export function handleSetFailureActionMessage(
  context: WorkerContext,
  message: SetFailureActionMessage,
) {
  const simulation = context.getSimulation();

  if (!simulation) {
    console.warn('-- tried setting failure action but no simulation');

    return;
  }

  simulation.setFailureAction(message.failureAction);
}
