import { buildDeferred } from './build-deferred';
import type { WorkerContext } from './types';
import type { UndeliveredWorkInput } from './worker-contract';

export async function handleRemoveUndeliveredWorkMessage(
  context: WorkerContext,
  input: Readonly<UndeliveredWorkInput>,
): Promise<void> {
  const deferred = buildDeferred<void>();

  context.getLifecycle().send({
    trigger: { avatarIDs: input.avatarIDs, deferred, kind: 'sign-out' },
    type: 'DISCARD',
  });

  await deferred.promise;
}
