import type { WorkerFaultSite } from './report-worker-fault';
import { reportWorkerFault } from './report-worker-fault';
import type { WorkerContext } from './types';

/**
 * Queues a lifecycle flow behind the mailbox tail: starts, resyncs, and continuations run
 * strictly one at a time. Only public entrypoints queue — a flow needing a sub-flow calls its
 * inner function directly, since a turn awaiting a turn queued behind itself deadlocks. The turn
 * never rejects (a throw would strand the queue); an escaping error reports as a fault under
 * `site`. Stops never queue — queued flows observe them through the stop epoch.
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
