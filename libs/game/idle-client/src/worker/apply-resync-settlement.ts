import invariant from 'tiny-invariant';
import { findHeldResyncClaim } from './find-held-resync-claim';
import type { WorkerLifecycleContext } from './types';

export function applyResyncSettlement(context: WorkerLifecycleContext): void {
  if (findHeldResyncClaim(context) !== null) {
    return;
  }

  const current = context.currentRequest;

  invariant(current?.kind === 'resync', 'expected a queued resync request');

  current.deferred.resolve();

  for (const carryOver of current.carryOverDeferreds) {
    carryOver.resolve();
  }
}
