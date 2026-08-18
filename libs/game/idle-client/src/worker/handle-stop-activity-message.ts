import { buildDeferred } from './build-deferred';
import type { StopActivityInput, WorkerContext } from './types';

/**
 * Sends a stop request to the lifecycle actor, which halts the local simulation synchronously — no
 * queueing behind an active flow — before this resolves. The durable delivery (flushing the row's
 * queued checkpoints, then the stop itself) runs concurrently with any active flow; this await
 * settles once that delivery lands.
 */
export async function handleStopActivityMessage(
  context: WorkerContext,
  input: Readonly<StopActivityInput>,
): Promise<void> {
  const deferred = buildDeferred<void>();

  context.getLifecycle().send({ deferred, input, type: 'STOP_ACTIVITY' });

  await deferred.promise;
}
