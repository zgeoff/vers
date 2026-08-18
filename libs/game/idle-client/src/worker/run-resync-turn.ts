import { buildDeferred } from './build-deferred';
import type { WorkerContext } from './types';

/**
 * Sends a resync request to the lifecycle actor, single-flight per worker: a non-claiming call
 * arriving while one is queued or running is dropped rather than stacked — the running one already
 * resyncs against the freshest server state a retry could see. A claiming call is never dropped: it
 * carries a deliberate take-over the running resync may not perform, so its avatar is held and
 * re-run once the in-flight one settles, the latest arrival winning — including a queued avatar
 * whose intent the account has since switched away from, since the requeued call resolves that
 * itself from the service's own rejection. The coalescing bookkeeping lives entirely in the actor,
 * so a resync an inner sub-flow runs inline cannot reopen the drop window for one still waiting on
 * its queue slot.
 */
export async function runResyncTurn(
  context: WorkerContext,
  avatarID: string,
  claim: boolean,
): Promise<void> {
  const deferred = buildDeferred<void>();

  context.getLifecycle().send({ avatarID, claim, deferred, type: 'RESYNC' });

  await deferred.promise;
}
