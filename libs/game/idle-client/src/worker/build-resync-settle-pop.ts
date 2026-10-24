import { buildDeferred } from './build-deferred';
import { buildResyncRequest } from './build-resync-request';
import { findHeldResyncClaim } from './find-held-resync-claim';
import type { PendingFlowRequest, WorkerLifecycleContext } from './types';

export function buildResyncSettlePop(
  context: WorkerLifecycleContext,
): Pick<WorkerLifecycleContext, 'currentRequest' | 'pending' | 'resyncTicket'> {
  const heldClaim = findHeldResyncClaim(context);
  const pending = foldHeldResyncClaim(context);

  return {
    currentRequest: pending[0] ?? null,
    pending: pending.slice(1),
    resyncTicket: heldClaim === null ? null : { pendingClaimAvatarID: null },
  };
}

function foldHeldResyncClaim(context: WorkerLifecycleContext): ReadonlyArray<PendingFlowRequest> {
  const heldClaim = findHeldResyncClaim(context);

  if (heldClaim === null) {
    return context.pending;
  }

  return [
    ...context.pending,
    buildResyncRequest(context, heldClaim.avatarID, true, buildDeferred<void>(), [
      ...heldClaim.current.carryOverDeferreds,
      heldClaim.current.deferred,
    ]),
  ];
}
