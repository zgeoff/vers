import invariant from 'tiny-invariant';
import { buildDeferred } from './build-deferred';
import { buildResyncRequest } from './build-resync-request';
import type { WorkerLifecycleContext } from './types';

// one prerequisite resync per start: a resync that settles without a record (a fresh avatar, a
// dead network) still lets the start run rather than requeue behind another
export function buildPrerequisiteResync(
  context: WorkerLifecycleContext,
): Pick<WorkerLifecycleContext, 'currentRequest' | 'pending' | 'resyncTicket'> {
  const request = context.currentRequest;

  invariant(request?.kind === 'start', 'a prerequisite resync is built for a start at the head');

  return {
    currentRequest: buildResyncRequest(
      context,
      request.input.avatarID,
      false,
      buildDeferred<void>(),
      [],
    ),
    pending: [{ ...request, awaitedResync: true }, ...context.pending],
    resyncTicket: context.resyncTicket ?? { pendingClaimAvatarID: null },
  };
}
