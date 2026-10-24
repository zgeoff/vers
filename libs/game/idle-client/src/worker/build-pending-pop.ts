import type { WorkerLifecycleContext } from './types';

export function buildPendingPop(
  context: WorkerLifecycleContext,
): Pick<WorkerLifecycleContext, 'currentRequest' | 'pending'> {
  return { currentRequest: context.pending[0] ?? null, pending: context.pending.slice(1) };
}
