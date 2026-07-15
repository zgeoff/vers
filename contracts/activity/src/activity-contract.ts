import { authedRoute, defineErrors } from '@vers/contract-base';
import * as z from 'zod';
import { ActivityDataSchema } from './activity-data-schema';
import { ActivityStatusSchema } from './activity-status-schema';
import { CheckpointBatchEntrySchema } from './checkpoint-batch-entry-schema';
import { CheckpointSchema } from './checkpoint-schema';
import { ScopeIdentifierSchema } from './scope-identifier-schema';

const CappedDataSchema = z.object({ appendedHead: z.int() });
const CheckpointInvalidDataSchema = z.object({ reason: z.string() });
const SimVersionProblemDataSchema = z.object({ currentSimVersion: z.string().nullable() });
const StaleHeadDataSchema = z.object({ appendedHead: z.int() });
const TerminalStatusDataSchema = z.object({ appendedHead: z.int(), status: ActivityStatusSchema });

const RewardItemAffixSchema = z.object({
  affixID: z.string(),
  groupID: z.string(),
  value: z.number(),
});

const RewardItemSchema = z.object({
  affixes: z.array(RewardItemAffixSchema),
  baseID: z.string(),
  contentVersion: z.string(),
  rarityID: z.string(),
});

const RevealedRewardSchema = z.object({
  chainIndex: z.int().min(0),
  item: RewardItemSchema,
  ordinal: z.int().min(0),
});

/**
 * The activities service's API: every procedure is authed and owner-scoped through the caller's
 * avatars.
 */
export const activityContract = {
  getActivityRewards: authedRoute
    .route({
      method: 'GET',
      path: '/activities/{activityID}/rewards',
      summary: "Get an activity's revealed reward-slot contents",
    })
    .input(z.object({ activityID: z.string(), afterChainIndex: z.int().min(0).optional() }))
    .output(z.object({ items: z.array(RevealedRewardSchema), verifiedHead: z.int() }))
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'No activity with that id' },
      }),
    ),

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
        serverTime: z.date(),
        verifiedHead: z.int(),
      }),
    )
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'No activity exists for this avatar' },
      }),
    ),

  resumeActivity: authedRoute
    .route({
      method: 'POST',
      path: '/activities/{activityID}/resume',
      summary: "Take over as an active activity's writer session",
    })
    .input(z.object({ activityID: z.string() }))
    .output(ActivityDataSchema)
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'No active activity with that id' },
      }),
    ),

  startActivity: authedRoute
    .route({
      method: 'POST',
      path: '/activities',
      summary: 'Start an activity for an avatar owned by the caller',
    })
    .input(
      z.object({
        avatarID: z.string(),
        scopeID: ScopeIdentifierSchema,
        scopeType: ScopeIdentifierSchema,
        simVersion: z.string().optional(),
      }),
    )
    .output(ActivityDataSchema)
    .errors(
      defineErrors({
        CHAIN_QUARANTINED: {
          data: z.object({}),
          message: 'The chain is quarantined pending replay adjudication',
          status: 409,
        },
        CONFLICT: {
          data: z.object({ activity: ActivityDataSchema }),
          message: 'An activity is already active for this avatar',
        },
        NOT_FOUND: { data: z.object({}), message: 'Avatar not found' },
        SIM_VERSION_EXPIRED: {
          data: SimVersionProblemDataSchema,
          message: 'The stamped or current sim version is past retention',
          status: 410,
        },
        SIM_VERSION_UNKNOWN: {
          data: SimVersionProblemDataSchema,
          message: 'The stamped or current sim version is not registered',
          status: 409,
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
        ACTIVITY_CAPPED: {
          data: CappedDataSchema,
          message: "Checkpoint batch exceeds the avatar's accrued offline-progress budget",
          status: 409,
        },
        ACTIVITY_TERMINAL: {
          data: TerminalStatusDataSchema,
          message: 'The activity has reached a terminal status and accepts no further appends',
          status: 409,
        },
        CHECKPOINT_INVALID: {
          data: CheckpointInvalidDataSchema,
          message: 'Checkpoint batch failed structural validation',
          status: 422,
        },
        CONFLICT: {
          data: StaleHeadDataSchema,
          message: "Checkpoint batch is stale for the activity's current head",
        },
        NOT_FOUND: { data: z.object({}), message: 'No activity with that id' },
        SESSION_EVICTED: {
          data: z.object({}),
          message: "The submitting session is no longer the activity's writer",
          status: 403,
        },
      }),
    ),
};

export type ActivityContract = typeof activityContract;
