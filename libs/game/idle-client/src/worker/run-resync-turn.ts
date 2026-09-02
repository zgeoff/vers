import { buildDeferred } from './build-deferred';
import type { WorkerContext } from './types';

export async function runResyncTurn(
  context: WorkerContext,
  avatarID: string,
  claim: boolean,
): Promise<void> {
  const deferred = buildDeferred<void>();

  context.getLifecycle().send({ avatarID, claim, deferred, type: 'RESYNC' });

  await deferred.promise;
}
