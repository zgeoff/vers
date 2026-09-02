import { authedRoute, defineErrors } from '@vers/contract-base';
import * as z from 'zod';
import { ReplaySegmentInputSchema } from './replay-segment-input-schema';
import { ReplaySegmentOutputSchema } from './replay-segment-output-schema';
import { WakeOutputSchema } from './wake-output-schema';

const SimVersionMismatchDataSchema = z.object({ providerSimVersion: z.string() });

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

  wake: authedRoute
    .route({
      method: 'POST',
      path: '/wake',
      summary: 'Drain the replay queue: claim and adjudicate every chain with claimable work',
    })
    .input(z.object({}))
    .output(WakeOutputSchema),
};

export type ReplayContract = typeof replayContract;
