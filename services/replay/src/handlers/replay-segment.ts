import type { ReplaySegmentInput, ReplaySegmentOutput } from '@vers/contract-replay';
import type { SimVersionMismatchPayload } from '../types';
import { runReplaySimulation } from './run-replay-simulation';

interface ReplaySegmentDeps {
  readonly simVersion: string;
}

interface ReplaySegmentOpts {
  readonly errors: {
    readonly SIM_VERSION_MISMATCH: (payload: SimVersionMismatchPayload) => Error;
  };
  readonly input: ReplaySegmentInput;
}

export function replaySegment(
  deps: ReplaySegmentDeps,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- input.activity/avatar are zod-inferred wire types with no readonly form
  opts: ReplaySegmentOpts,
): Promise<ReplaySegmentOutput> {
  if (opts.input.simVersion !== deps.simVersion) {
    throw opts.errors.SIM_VERSION_MISMATCH({ data: { providerSimVersion: deps.simVersion } });
  }

  return runReplaySimulation(opts.input);
}
