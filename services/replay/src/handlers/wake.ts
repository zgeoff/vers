import type { WakeOutput } from '@vers/contract-replay';
import { drainReplayQueue } from '../worker/drain-replay-queue';
import type { ReplayWorkerDeps } from '../worker/types';

/**
 * Drains every claimable chain the replay queue currently holds and reports how many it drained.
 */
export async function wake(deps: Readonly<ReplayWorkerDeps>): Promise<WakeOutput> {
  const drained = await drainReplayQueue(deps);

  return { drained };
}
