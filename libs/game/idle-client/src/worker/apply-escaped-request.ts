import type { WorkerFaultSite } from './report-worker-fault';
import { reportWorkerFault } from './report-worker-fault';
import type { WorkerLifecycleContext } from './types';

export function applyEscapedRequest(
  context: WorkerLifecycleContext,
  site: WorkerFaultSite,
  error: unknown,
): void {
  reportWorkerFault(site, error);

  const request = context.currentRequest;

  if (request === null || request.kind === 'eviction' || request.kind === 'discard') {
    return;
  }

  if (request.kind === 'start') {
    request.deferred.resolve({ kind: 'failed' });

    return;
  }

  request.deferred.resolve();

  if (request.kind === 'resync') {
    for (const carryOver of request.carryOverDeferreds) {
      carryOver.resolve();
    }
  }
}
