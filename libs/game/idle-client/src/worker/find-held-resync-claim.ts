import type { PendingFlowRequestOf, WorkerLifecycleContext } from './types';

export function findHeldResyncClaim(
  context: WorkerLifecycleContext,
): { readonly avatarID: string; readonly current: PendingFlowRequestOf<'resync'> } | null {
  const ticket = context.resyncTicket;
  const current = context.currentRequest;

  if (
    ticket === null ||
    ticket.pendingClaimAvatarID === null ||
    current === null ||
    current.kind !== 'resync'
  ) {
    return null;
  }

  return { avatarID: ticket.pendingClaimAvatarID, current };
}
