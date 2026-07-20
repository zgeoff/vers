import type { WorkerFaultSite } from './report-worker-fault';
import { reportWorkerFault } from './report-worker-fault';
import type { WorkerContext } from './types';

/**
 * Runs a lifecycle flow on the worker's one chain: the flow waits for its predecessor to settle,
 * so start, resync, and continuation work never interleave — a stale flow can never install over
 * or stop out a fresher one's work. Stops stay off the chain; their local halt is immediate and
 * their epoch bump is what queued flows re-check. A flow that throws is reported against the
 * given site and settles the chain cleanly — a rejection would strand every queued flow behind
 * it. Nested lifecycle work inside a running flow calls its target directly; chaining it again
 * would deadlock the chain on itself.
 */
export async function runOnLifecycleChain(
  context: WorkerContext,
  site: WorkerFaultSite,
  flow: () => Promise<void>,
): Promise<void> {
  const previous = context.getLifecycleFlow();

  const chained = (async () => {
    await previous;

    try {
      await flow();
    } catch (error) {
      reportWorkerFault(site, error);
    }
  })();

  context.setLifecycleFlow(chained);

  await chained;
}
