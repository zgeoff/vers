import { runResyncFlow } from './run-resync-flow';
import type { FlowSignals, WorkerContext } from './types';
import { withLifecycleTurn } from './with-lifecycle-turn';

/**
 * Queues one resync as a lifecycle turn, single-flight per worker: a non-claiming call arriving
 * while one is queued or running is dropped rather than stacked — the running one already resyncs
 * against the freshest server state a retry could see. A claiming call is never dropped: it
 * carries a deliberate take-over the running resync may not perform, so its avatar is held and
 * re-run once the in-flight one settles, the latest arrival winning — including a queued avatar
 * whose intent the account has since switched away from, since the requeued call resolves that
 * itself from the service's own rejection. The wrapper alone owns the in-flight flag; the inner
 * flow never touches it, so an inline resync run from inside another lifecycle turn cannot reopen
 * the drop window for a resync still waiting in the queue. The signals are captured at arrival, so
 * a stop or shutdown raised while the turn waits its queue slot still cancels the flow's installs
 * and in-flight reads.
 */
export async function runResyncTurn(
  context: WorkerContext,
  avatarID: string,
  claim: boolean,
): Promise<void> {
  if (context.isResyncInFlight()) {
    if (claim) {
      context.setQueuedClaimResync(avatarID);
    }

    return;
  }

  context.setResyncInFlight(true);

  const signals: FlowSignals = { cancel: context.getCancelSignal(), stop: context.getStopSignal() };

  try {
    await withLifecycleTurn(context, 'resync', () =>
      runResyncFlow(context, avatarID, claim, signals),
    );
  } finally {
    context.setResyncInFlight(false);
  }

  const queued = context.getQueuedClaimResync();

  if (queued !== null) {
    context.setQueuedClaimResync(null);

    await runResyncTurn(context, queued, true);
  }
}
