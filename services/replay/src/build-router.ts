import { implement } from '@orpc/server';
import { replayContract } from '@vers/contract-replay';
import type { ServiceContext } from '@vers/service-runtime';
import { replaySegment } from './handlers/replay-segment';
import { wake } from './handlers/wake';
import type { ReplayWorkerDeps } from './worker/types';

/**
 * Assembles the replay service's oRPC router: `replaySegment` closes over the baked engine hash
 * this deploy serves, and `wake` closes over everything a queue drain needs to claim and adjudicate
 * chains.
 */
export function buildReplayRouter(deps: ReplayWorkerDeps) {
  const os = implement(replayContract).$context<ServiceContext>();

  return {
    replaySegment: os.replaySegment.handler((opts) =>
      replaySegment({ simVersion: deps.simVersion }, opts),
    ),
    wake: os.wake.handler(() => wake(deps)),
  };
}

export type ReplayRouter = ReturnType<typeof buildReplayRouter>;
