import { implement } from '@orpc/server';
import { replayContract } from '@vers/contract-replay';
import type { ServiceContext } from '@vers/service-runtime';
import { replaySegment } from './handlers/replay-segment';
import { wake } from './handlers/wake';
import type { ReplayWorkerDeps } from './worker/types';

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
