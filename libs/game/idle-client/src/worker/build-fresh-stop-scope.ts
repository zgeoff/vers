import type { WorkerLifecycleContext } from './types';

export function buildFreshStopScope(
  context: WorkerLifecycleContext,
): Pick<WorkerLifecycleContext, 'cancelSignal' | 'stopController'> {
  const stopController = new AbortController();

  return {
    cancelSignal: AbortSignal.any([stopController.signal, context.shutdownSignal]),
    stopController,
  };
}
