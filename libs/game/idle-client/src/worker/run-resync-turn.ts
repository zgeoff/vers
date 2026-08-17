import { runResyncFlow } from './run-resync-flow';
import type { FlowSignals, WorkerContext } from './types';

/**
 * Queues one resync through the mailbox, single-flight per worker: a non-claiming call arriving
 * while one is queued or running is dropped rather than stacked — the running one already resyncs
 * against the freshest server state a retry could see. A claiming call is never dropped: it
 * carries a deliberate take-over the running resync may not perform, so its avatar is held and
 * re-run once the in-flight one settles, the latest arrival winning — including a queued avatar
 * whose intent the account has since switched away from, since the requeued call resolves that
 * itself from the service's own rejection. Coalescing state lives entirely inside the mailbox, so
 * an inline resync run from inside another lifecycle turn cannot reopen the drop window for a
 * resync still waiting in the queue. Signals are captured fresh each time the mailbox actually
 * starts a run — at this call's own arrival, and again at any held claim's requeue — so a stop or
 * shutdown raised while a turn waits its queue slot still cancels that run's installs and
 * in-flight reads.
 */
export async function runResyncTurn(
  context: WorkerContext,
  avatarID: string,
  claim: boolean,
): Promise<void> {
  await context.getMailbox().runResyncTurn(avatarID, claim, (nextAvatarID, nextClaim) => {
    const signals: FlowSignals = {
      cancel: context.getCancelSignal(),
      stop: context.getStopSignal(),
    };

    return () => runResyncFlow(context, nextAvatarID, nextClaim, signals);
  });
}
