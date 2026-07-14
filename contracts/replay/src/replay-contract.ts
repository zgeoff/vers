import { authedRoute, defineErrors } from '@vers/contract-base';
import * as z from 'zod';
import { ActivityCheckpointSchema } from './activity-checkpoint-schema';
import { ActivityInputSchema } from './activity-input-schema';
import { AvatarDataSchema } from './avatar-data-schema';

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
    .input(
      z.object({
        activity: ActivityInputSchema,
        avatar: AvatarDataSchema,
        duration: z.number(),

        /**
         * Called cross-version — today's dispatcher can call a provider frozen weeks ago — so this
         * field only ever evolves additively.
         */
        protocol: z.literal(1),
        simVersion: z.string(),
        stopAtState: z.string().optional(),
      }),
    )
    .output(
      z.object({
        checkpoints: z.array(ActivityCheckpointSchema),
        elapsed: z.number(),
      }),
    )
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
