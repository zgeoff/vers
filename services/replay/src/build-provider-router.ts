import { implement } from '@orpc/server';
import { replayContract } from '@vers/contract-replay';
import type { ServiceContext } from '@vers/service-runtime';
import { replaySegment } from './handlers/replay-segment';

interface BuildProviderRouterDeps {
  readonly simVersion: string;
}

/**
 * Assembles the provider-mode router: only `replaySegment`, closing over the baked engine hash this
 * deploy serves. No `wake` route — a provider machine never claims or drains a seed chain, and an
 * unmatched path 404s at the transport.
 */
export function buildProviderRouter(deps: Readonly<BuildProviderRouterDeps>) {
  const os = implement({ replaySegment: replayContract.replaySegment }).$context<ServiceContext>();

  return {
    replaySegment: os.replaySegment.handler((opts) =>
      replaySegment({ simVersion: deps.simVersion }, opts),
    ),
  };
}

export type ProviderRouter = ReturnType<typeof buildProviderRouter>;
