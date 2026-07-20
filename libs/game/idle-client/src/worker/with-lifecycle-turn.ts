import type { WorkerFaultSite } from './report-worker-fault';
import { reportWorkerFault } from './report-worker-fault';
import type { WorkerContext } from './types';

/**
 * Queues a lifecycle flow behind the mailbox tail and runs it once every earlier flow has
 * settled, so starts, resyncs, and continuations execute strictly one at a time. Only public
 * entrypoints queue a turn — a flow that needs a sub-flow calls its inner function directly,
 * since a turn awaiting a turn queued behind itself would deadlock the mailbox. The turn settles
 * without rejecting — a throw would strand every queued flow behind it — so a flow that wants its
 * own failure signalling catches inside its callback; anything that escapes is reported as a
 * fault under the caller's site. Stops never queue: their local halt is instant, and a queued
 * flow observes them through the stop epoch instead.
 */
export async function withLifecycleTurn(
  context: WorkerContext,
  site: WorkerFaultSite,
  fn: () => Promise<void>,
): Promise<void> {
  const previous = context.getLifecycleTail();

  const turn = (async () => {
    await previous;

    try {
      await fn();
    } catch (error) {
      reportWorkerFault(site, error);
    }
  })();

  context.setLifecycleTail(turn);

  await turn;
}
