import type { RequestResyncMessage } from '../types';
import { runResyncFlow } from './run-resync-flow';
import type { WorkerContext } from './types';
import { withLifecycleTurn } from './with-lifecycle-turn';

/**
 * Queues one resync as a lifecycle turn, single-flight per worker: a non-claiming request
 * arriving while one is queued or running is dropped rather than stacked — the running one
 * already resyncs against the freshest server state a retry could see. A claiming request is
 * never dropped: it carries a deliberate take-over the running resync may not perform, so it is
 * held and re-run once the in-flight one settles, the latest arrival winning. The wrapper alone
 * owns the in-flight flag; the inner flow never touches it, so an inline resync run from inside
 * another lifecycle turn cannot reopen the drop window for a resync still waiting in the queue.
 * The stop epoch is captured at arrival, so a stop raised while the turn waits its queue slot
 * still aborts the flow's installs.
 */
export async function handleRequestResyncMessage(
  context: WorkerContext,
  message: RequestResyncMessage,
): Promise<void> {
  if (context.isResyncInFlight()) {
    if (message.claim) {
      context.setQueuedClaimResync(message);
    }

    return;
  }

  context.setResyncInFlight(true);

  const entryEpoch = context.getStopEpoch();

  try {
    await withLifecycleTurn(context, 'resync', () => runResyncFlow(context, message, entryEpoch));
  } finally {
    context.setResyncInFlight(false);
  }

  const queued = context.getQueuedClaimResync();

  if (queued !== null) {
    context.setQueuedClaimResync(null);

    await handleRequestResyncMessage(context, queued);
  }
}
