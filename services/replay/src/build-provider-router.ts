import { implement } from '@orpc/server';
import { replayContract } from '@vers/contract-replay';
import type { ServiceContext } from '@vers/service-runtime';
import { replaySegment } from './handlers/replay-segment';

interface BuildProviderRouterDeps {
  readonly simVersion: string;
}

export function buildProviderRouter(deps: Readonly<BuildProviderRouterDeps>) {
  const os = implement({ replaySegment: replayContract.replaySegment }).$context<ServiceContext>();

  return {
    replaySegment: os.replaySegment.handler((opts) =>
      replaySegment({ simVersion: deps.simVersion }, opts),
    ),
  };
}

export type ProviderRouter = ReturnType<typeof buildProviderRouter>;
