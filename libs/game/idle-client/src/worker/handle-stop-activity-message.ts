import { buildDeferred } from './build-deferred';
import type { StopActivityInput, WorkerContext } from './types';

export async function handleStopActivityMessage(
  context: WorkerContext,
  input: Readonly<StopActivityInput>,
): Promise<void> {
  const deferred = buildDeferred<void>();

  context.getLifecycle().send({ deferred, input, type: 'STOP_ACTIVITY' });

  await deferred.promise;
}
