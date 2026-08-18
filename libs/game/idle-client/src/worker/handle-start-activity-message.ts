import { buildDeferred } from './build-deferred';
import type { StartActivityInput, WorkerContext } from './types';
import type { StartStatus } from './worker-contract';

/**
 * Sends a start request to the lifecycle actor and answers with its outcome — minted, attached, or
 * failed. The data-plane body (`runStartFlow`) runs inside the actor's own queue, one flow at a
 * time; this entry point never runs it inline.
 */
export function handleStartActivityMessage(
  context: WorkerContext,
  input: Readonly<StartActivityInput>,
): Promise<StartStatus> {
  const deferred = buildDeferred<StartStatus>();

  context.getLifecycle().send({ deferred, input, type: 'START' });

  return deferred.promise;
}
