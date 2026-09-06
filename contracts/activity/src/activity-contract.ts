import { authedRoute, defineErrors } from '@vers/contract-base';
import { WORLD_COORD_MAX, WORLD_COORD_MIN } from '@vers/worldmap-core';
import * as z from 'zod';
import { ActivityDataSchema } from './activity-data-schema';
import { ActivityFailureActionSchema } from './activity-failure-action-schema';
import { ActivityStatusSchema } from './activity-status-schema';
import { AdvanceCheckpointInvalidReasonSchema } from './advance-checkpoint-invalid-reason-schema';
import { BuildSnapshotSchema } from './build-snapshot-schema';
import { CatchUpContinuationSchema } from './catch-up-continuation-schema';
import { CheckpointBatchEntrySchema } from './checkpoint-batch-entry-schema';
import { CheckpointInvalidReasonSchema } from './checkpoint-invalid-reason-schema';
import { CheckpointSchema } from './checkpoint-schema';
import { ContentDocumentSchema } from './content-document-schema';
import { EncounterNodeSchema } from './encounter-node-schema';
import { MAX_CATCH_UP_BATCH_CHECKPOINTS } from './max-catch-up-batch-checkpoints';
import { MAX_REVEAL_BATCH_NODES } from './max-reveal-batch-nodes';
import { OfflineActivityStartSubmissionSchema } from './offline-activity-start-submission-schema';
import { REVEAL_VIEWPORT_CELL_CAP } from './reveal-viewport-cell-cap';
import { RewardItemAffixSchema } from './reward-item-affix-schema';
import { ScopeIdentifierSchema } from './scope-identifier-schema';

const AvatarNotActiveDataSchema = z.object({
  activeAvatarID: z.string(),
  activeAvatarName: z.string(),
});

const CappedDataSchema = z.object({ appendedHead: z.int() });
const CheckpointInvalidDataSchema = z.object({ reason: CheckpointInvalidReasonSchema });
const SimVersionProblemDataSchema = z.object({ currentSimVersion: z.string().nullable() });
const StaleHeadDataSchema = z.object({ appendedHead: z.int() });
const TerminalStatusDataSchema = z.object({ appendedHead: z.int(), status: ActivityStatusSchema });
const AdvanceBailDataSchema = z.object({ activityID: z.string(), appendedHead: z.int() });

const AdvanceCheckpointInvalidDataSchema = AdvanceBailDataSchema.extend({
  reason: AdvanceCheckpointInvalidReasonSchema,
});

const AdvanceTerminalDataSchema = AdvanceBailDataSchema.extend({ status: ActivityStatusSchema });

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
const ActiveXPEntrySchema = z.object({ activityID: z.string(), settledXP: z.int() });

const AvatarProgressionSchema = z.object({
  active: ActiveXPEntrySchema.nullish(),
  level: z.int(),
  pending: z.array(PendingXPEntrySchema),
  xp: z.int(),
});

const CellAxisSchema = z.int().min(WORLD_COORD_MIN).max(WORLD_COORD_MAX);

const ViewportSchema = z.object({
  maxCX: CellAxisSchema,
  maxCY: CellAxisSchema,
  minCX: CellAxisSchema,
  minCY: CellAxisSchema,
});

const RevealedNodeSchema = z.object({ id: z.string(), poolID: z.string().optional() });
const NodeGenesisAnchorSchema = z.object({ chainIndex: z.int().min(0), nextSeed: z.string() });

const NodeGenesisSchema = z.object({
  anchor: NodeGenesisAnchorSchema,
  contentVersion: z.string(),
  encounterNode: EncounterNodeSchema,
  genesisSeed: z.string(),
  nodeID: z.string(),
});

const RevealStampsSchema = z.object({
  keyVersion: z.int().min(1),
  secretRef: z.string(),
  secretVersion: z.int().min(1),
});

const CompletedNodeIDsSchema = z.array(z.string());

export const activityContract = {
  advanceActivity: authedRoute
    .route({
      method: 'POST',
      path: '/activities/{activityID}/advance',
      summary: 'Bulk mint-and-append offline catch-up continuations onto an activity chain',
    })
    .input(
      z
        .object({
          activityID: z.string(),

          activityStart: OfflineActivityStartSubmissionSchema.optional(),

          // Empty when the activity start carries the whole request: an ingest with no
          // continuations mints the row and appends nothing.
          continuations: z
            .array(CatchUpContinuationSchema)
            .max(MAX_CATCH_UP_BATCH_CHECKPOINTS)
            .readonly(),
          expectedHead: z.int().min(0),
        })

        // The per-array caps alone still admit continuations × checkpoints work; the aggregate
        // bound is what keeps a direct API caller's synchronous hash and insert cost per request
        // flat, matching the honest client's per-request total.
        .refine(
          (input) =>
            input.continuations.reduce((total, entry) => total + entry.checkpoints.length, 0) <=
            MAX_CATCH_UP_BATCH_CHECKPOINTS,
          {
            error: `a request carries at most ${MAX_CATCH_UP_BATCH_CHECKPOINTS} checkpoints across all continuations`,
          },
        )

        // Every request mints or appends something: an empty `continuations` is legal only when
        // the activity start carries the whole request, never a no-op carrying neither, which
        // would return the head unchanged.
        .refine((input) => input.activityStart !== undefined || input.continuations.length > 0, {
          error: 'a request with no continuations must carry an activity start to mint',
        }),
    )
    .output(z.object({ activity: ActivityDataSchema, appendedHead: z.int() }))
    .errors(
      defineErrors({
        ACTIVITY_CAPPED: {
          data: AdvanceBailDataSchema,
          message: "A continuation's tail exceeds the avatar's accrued offline-progress budget",
          status: 409,
        },
        ACTIVITY_TERMINAL: {
          data: AdvanceTerminalDataSchema,
          message: 'A continuation targets an activity that already reached a terminal status',
          status: 409,
        },
        AVATAR_NOT_ACTIVE: {
          data: AvatarNotActiveDataSchema,
          message: "An activity start admission's avatar is not the account's active one",
          status: 409,
        },
        CHAIN_QUARANTINED: {
          data: AdvanceBailDataSchema,
          message: 'The chain is quarantined pending replay adjudication',
          status: 409,
        },
        CHECKPOINT_INVALID: {
          data: AdvanceCheckpointInvalidDataSchema,
          message: "A continuation's checkpoint tail failed structural or cross-check validation",
          status: 422,
        },
        CONFLICT: {
          data: AdvanceBailDataSchema,
          message: "A continuation's mint or append is stale for the chain's current state",
        },
        NODE_NOT_REVEALED: {
          data: z.object({}),
          message: "An activity start's scope has no revealed chain to anchor against",
          status: 409,
        },
        NODE_UNKNOWN: {
          data: z.object({}),
          message: "An activity start admission's scope node is not registered on the world map",
          status: 404,
        },
        NOT_FOUND: { data: z.object({}), message: 'No activity with that id' },
        SESSION_EVICTED: {
          data: AdvanceBailDataSchema,
          message: "The submitting session is no longer the activity's writer",
          status: 403,
        },
        SIM_VERSION_EXPIRED: {
          data: SimVersionProblemDataSchema,
          message: "An activity start admission's stamped sim version is past retention",
          status: 410,
        },
        SIM_VERSION_UNKNOWN: {
          data: SimVersionProblemDataSchema,
          message: "An activity start admission's stamped sim version is not registered",
          status: 409,
        },
      }),
    ),

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

  getContentDocument: authedRoute
    .route({
      method: 'GET',
      path: '/content/{contentVersion}',
      summary: "Get a published content version's document",
    })
    .input(z.object({ contentVersion: z.string() }))
    .output(ContentDocumentSchema)
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'No published content version with that id' },
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
        failureAction: ActivityFailureActionSchema,

        isWriter: z.boolean(),

        optimisticBuild: BuildSnapshotSchema,

        serverTime: z.date(),
        verifiedHead: z.int(),
      }),
    )
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'No activity exists for this avatar' },
      }),
    ),

  getRevealedNodes: authedRoute
    .route({
      method: 'GET',
      path: '/avatars/{avatarID}/revealed-nodes',
      summary: "Get the disclosed content for an avatar's revealed world-map cells in a viewport",
    })
    .input(
      z
        .object({ avatarID: z.string(), viewport: ViewportSchema })
        .refine(
          (input) =>
            input.viewport.maxCX >= input.viewport.minCX &&
            input.viewport.maxCY >= input.viewport.minCY,
          { error: 'viewport bounds are inverted' },
        )
        .refine(
          (input) =>
            (input.viewport.maxCX - input.viewport.minCX + 1) *
              (input.viewport.maxCY - input.viewport.minCY + 1) <=
            REVEAL_VIEWPORT_CELL_CAP,
          { error: `viewport area may not exceed ${REVEAL_VIEWPORT_CELL_CAP} cells` },
        ),
    )
    .output(
      z.object({
        completedNodeIDs: CompletedNodeIDsSchema,
        contentVersion: z.string(),
        nodes: z.array(RevealedNodeSchema),
      }),
    )
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'Avatar not found' },
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

  revealNodes: authedRoute
    .route({
      method: 'POST',
      path: '/avatars/{avatarID}/revealed-nodes',
      summary: "Mint genesis chains for an avatar's newly revealed world-map nodes",
    })
    .input(
      z.object({
        avatarID: z.string(),
        nodeIDs: z.array(ScopeIdentifierSchema).max(MAX_REVEAL_BATCH_NODES),
      }),
    )
    .output(RevealStampsSchema.extend({ nodes: z.array(NodeGenesisSchema) }))
    .errors(
      defineErrors({
        AVATAR_NOT_ACTIVE: {
          data: AvatarNotActiveDataSchema,
          message: "The account's active avatar is not the one revealing",
          status: 409,
        },
        NODE_UNKNOWN: {
          data: z.object({}),
          message: 'The scope node is not registered on the world map',
          status: 404,
        },
        NOT_FOUND: { data: z.object({}), message: 'Avatar not found' },
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
