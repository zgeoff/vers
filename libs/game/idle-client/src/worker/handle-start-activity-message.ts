import { buildDeferred } from './build-deferred';
import type { StartActivityInput, WorkerContext } from './types';
import type { StartStatus } from './worker-contract';

export function handleStartActivityMessage(
  context: WorkerContext,
  input: Readonly<StartActivityInput>,
): Promise<StartStatus> {
  const deferred = buildDeferred<StartStatus>();

  context.getLifecycle().send({ deferred, input, type: 'START' });

  return deferred.promise;
}
