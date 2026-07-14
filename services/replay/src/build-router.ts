import { implement } from '@orpc/server';
import { replayContract } from '@vers/contract-replay';
import type { ServiceContext } from '@vers/service-runtime';
import { replaySegment } from './handlers/replay-segment';

interface BuildReplayRouterDeps {
  readonly simVersion: string;
}

/**
 * Assembles the replay service's oRPC router, closing the single `replaySegment` handler over the
 * baked engine hash this deploy serves.
 */
export function buildReplayRouter(deps: BuildReplayRouterDeps) {
  const os = implement(replayContract).$context<ServiceContext>();

  return {
    replaySegment: os.replaySegment.handler((opts) => replaySegment(deps, opts)),
  };
}

export type ReplayRouter = ReturnType<typeof buildReplayRouter>;
