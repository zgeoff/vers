import type { WorkerLifecycleContext } from './types';

export function applyTeardownSettlement(context: WorkerLifecycleContext): void {
  const requests = [context.currentRequest, ...context.pending];

  for (const request of requests) {
    if (request === null || request.kind === 'eviction') {
      continue;
    }

    if (request.kind === 'start') {
      request.deferred.resolve({ kind: 'failed' });
      continue;
    }

    request.deferred.resolve();

    if (request.kind === 'resync') {
      for (const carryOver of request.carryOverDeferreds) {
        carryOver.resolve();
      }
    }
  }
}
