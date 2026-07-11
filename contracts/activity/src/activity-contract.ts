import { authedRoute, defineErrors } from '@vers/contract-base';
import * as z from 'zod';
import { ActivityDataSchema } from './activity-data-schema';
import { CheckpointBatchEntrySchema } from './checkpoint-batch-entry-schema';
import { CheckpointSchema } from './checkpoint-schema';

const CheckpointInvalidDataSchema = z.object({ reason: z.string() });
const StaleHeadDataSchema = z.object({ appendedHead: z.int() });

/**
 * The activities service's API: every procedure is authed and owner-scoped through the caller's
 * avatars.
 */
export const activityContract = {
  getCurrentActivity: authedRoute
    .route({
      method: 'GET',
      path: '/avatars/{avatarID}/activity',
      summary: 'Get the active activity for an avatar owned by the caller',
    })
    .input(z.object({ avatarID: z.string() }))
    .output(ActivityDataSchema.nullable()),

  getLatestActivityProgress: authedRoute
    .route({
      method: 'GET',
      path: '/avatars/{avatarID}/activity/progress',
      summary: "Get an avatar's latest activity and its resume progress",
    })
    .input(z.object({ avatarID: z.string() }))
    .output(
      z.object({
        activity: ActivityDataSchema,
        anchor: CheckpointSchema.nullable(),
        appendedHead: z.int(),
        verifiedHead: z.int(),
      }),
    )
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'No activity exists for this avatar' },
      }),
    ),

  startActivity: authedRoute
    .route({
      method: 'POST',
      path: '/activities',
      summary: 'Start an activity for an avatar owned by the caller',
    })
    .input(z.object({ avatarID: z.string(), nodeID: z.string() }))
    .output(ActivityDataSchema)
    .errors(
      defineErrors({
        CONFLICT: {
          data: z.object({ activity: ActivityDataSchema }),
          message: 'An activity is already active for this avatar',
        },
      }),
    ),

  stopActivity: authedRoute
    .route({
      method: 'POST',
      path: '/activities/stop',
      summary: 'Stop the active activity for an avatar owned by the caller',
    })
    .input(z.object({ avatarID: z.string() }))
    .output(ActivityDataSchema)
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'No active activity for this avatar' },
      }),
    ),

  trackActivityProgress: authedRoute
    .route({
      method: 'POST',
      path: '/activities/{activityID}/checkpoints',
      summary: "Append a checkpoint batch to an activity's stream",
    })
    .input(
      z.object({
        activityID: z.string(),
        checkpoints: z.array(CheckpointBatchEntrySchema),
        expectedHead: z.int().min(0),
      }),
    )
    .output(z.object({ appendedHead: z.int() }))
    .errors(
      defineErrors({
        CHECKPOINT_INVALID: {
          data: CheckpointInvalidDataSchema,
          message: 'Checkpoint batch failed structural validation',
          status: 422,
        },
        CONFLICT: {
          data: StaleHeadDataSchema,
          message: "Checkpoint batch is stale for the activity's current head",
        },
        NOT_FOUND: { data: z.object({}), message: 'No active activity with that id' },
      }),
    ),
};

export type ActivityContract = typeof activityContract;
