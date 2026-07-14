import { authedRoute, defineErrors } from '@vers/contract-base';
import * as z from 'zod';
import { ReplaySegmentInputSchema } from './replay-segment-input-schema';
import { ReplaySegmentOutputSchema } from './replay-segment-output-schema';

const SimVersionMismatchDataSchema = z.object({ providerSimVersion: z.string() });

/**
 * The replay service's API: one provider endpoint the dispatcher calls to re-run a simulation
 * segment against this deploy's baked engine.
 */
export const replayContract = {
  replaySegment: authedRoute
    .route({
      method: 'POST',
      path: '/replay-segment',
      summary: "Replay a simulation segment against this provider's baked engine",
    })
    .input(ReplaySegmentInputSchema)
    .output(ReplaySegmentOutputSchema)
    .errors(
      defineErrors({
        SIM_VERSION_MISMATCH: {
          data: SimVersionMismatchDataSchema,
          message: "The request's simVersion does not match this provider's baked engine hash",
          status: 409,
        },
      }),
    ),
};

export type ReplayContract = typeof replayContract;
