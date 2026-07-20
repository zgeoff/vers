import { authedRoute, defineErrors } from '@vers/contract-base';
import * as z from 'zod';
import { ActivityDataSchema } from './activity-data-schema';
import { ActivityFailureActionSchema } from './activity-failure-action-schema';
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

const PendingXPEntrySchema = z.object({ activityID: z.string(), xpDelta: z.number() });

const AvatarProgressionSchema = z.object({
  level: z.int(),
  pending: z.array(PendingXPEntrySchema),
  xp: z.int(),
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

  getAvatarProgression: authedRoute
    .route({
      method: 'GET',
      path: '/avatars/{avatarID}/progression',
      summary: "Get an avatar's settled xp/level plus pending unsettled xp deltas",
    })
    .input(z.object({ avatarID: z.string() }))
    .output(AvatarProgressionSchema.nullable()),

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
        failureAction: ActivityFailureActionSchema,

        /**
         * Whether the calling session may append to the activity's stream: it is the stamped
         * writer, or no writer is stamped yet. `false` means another session owns the stream and
         * an append would be rejected.
         */
        isWriter: z.boolean(),

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

        /**
         * Idempotency key stamped on the minted row. A duplicate delivery carrying the same key
         * succeeds with the existing row while it is never-appended; distinct intents into the
         * same scope carry distinct keys and still conflict.
         */
        startKey: z.string().max(128).optional(),
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
        NODE_UNKNOWN: {
          data: z.object({}),
          message: 'The scope node is not registered on the world map',
          status: 404,
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
    .input(
      z.object({
        /**
         * Targets one specific row, making the call idempotent: stopping a row that already left
         * `active` succeeds with that row as-is, and a row other than the targeted one is never
         * touched — so a stop delivered late, or twice, from a durable client queue can neither
         * fail spuriously nor kill a newer run. Without it, the call keeps its original meaning:
         * stop whatever is active, `NOT_FOUND` when nothing is.
         */
        activityID: z.string().optional(),
        avatarID: z.string(),
      }),
    )
    .output(ActivityDataSchema)
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'No active activity for this avatar' },
        SESSION_EVICTED: {
          data: z.object({}),
          message: "The stopping session is no longer the activity's writer",
          status: 403,
        },
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

  updateFailureAction: authedRoute
    .route({
      method: 'PUT',
      path: '/avatars/{avatarID}/activity/failure-action',
      summary: "Persist an avatar's failure-action preference",
    })
    .input(z.object({ avatarID: z.string(), failureAction: ActivityFailureActionSchema }))
    .output(z.object({ failureAction: ActivityFailureActionSchema }))
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'Avatar not found' },
      }),
    ),
};

export type ActivityContract = typeof activityContract;
