import { authedRoute, defineErrors } from '@vers/contract-base';
import { WORLD_COORD_MAX, WORLD_COORD_MIN } from '@vers/worldmap-core';
import * as z from 'zod';
import { ActivityDataSchema } from './activity-data-schema';
import { ActivityFailureActionSchema } from './activity-failure-action-schema';
import { ActivityStatusSchema } from './activity-status-schema';
import { CatchUpContinuationSchema } from './catch-up-continuation-schema';
import { CheckpointBatchEntrySchema } from './checkpoint-batch-entry-schema';
import { CheckpointSchema } from './checkpoint-schema';
import { ContentDocumentSchema } from './content-document-schema';
import { EncounterNodeSchema } from './encounter-node-schema';
import { MAX_CATCH_UP_BATCH_CHECKPOINTS } from './max-catch-up-batch-checkpoints';
import { MAX_REVEAL_BATCH_NODES } from './max-reveal-batch-nodes';
import { OfflineRootSubmissionSchema } from './offline-root-submission-schema';
import { REVEAL_VIEWPORT_CELL_CAP } from './reveal-viewport-cell-cap';
import { RewardItemAffixSchema } from './reward-item-affix-schema';
import { ScopeIdentifierSchema } from './scope-identifier-schema';

const AvatarNotActiveDataSchema = z.object({
  activeAvatarID: z.string(),
  activeAvatarName: z.string(),
});

const CappedDataSchema = z.object({ appendedHead: z.int() });
const CheckpointInvalidDataSchema = z.object({ reason: z.string() });
const SimVersionProblemDataSchema = z.object({ currentSimVersion: z.string().nullable() });
const StaleHeadDataSchema = z.object({ appendedHead: z.int() });
const TerminalStatusDataSchema = z.object({ appendedHead: z.int(), status: ActivityStatusSchema });

/**
 * `advanceActivity`'s uniform bail data: the last row a rejected bulk request fully committed,
 * whatever reason stopped it — the row the client's outer resync re-plans from.
 */
const AdvanceBailDataSchema = z.object({ activityID: z.string(), appendedHead: z.int() });
const AdvanceCheckpointInvalidDataSchema = AdvanceBailDataSchema.extend({ reason: z.string() });
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

/**
 * The live activity's xp already on the settled row, so a client overlaying that run's own running
 * total subtracts what it would otherwise count twice. Absent while no activity is live, and from
 * a service deployed before the field existed — both read as nothing settled yet.
 */
const ActiveXPEntrySchema = z.object({ activityID: z.string(), settledXP: z.int() });

const AvatarProgressionSchema = z.object({
  active: ActiveXPEntrySchema.nullish(),
  level: z.int(),
  pending: z.array(PendingXPEntrySchema),
  xp: z.int(),
});

/**
 * One cell-coordinate axis value, bounded to the range a world-map cell coordinate packs into. An
 * axis outside it names a cell the map cannot address at all.
 */
const CellAxisSchema = z.int().min(WORLD_COORD_MIN).max(WORLD_COORD_MAX);

const ViewportSchema = z.object({
  maxCX: CellAxisSchema,
  maxCY: CellAxisSchema,
  minCX: CellAxisSchema,
  minCY: CellAxisSchema,
});

/**
 * A revealed cell's disclosed content: expected-value-flat descriptor metadata only, never the raw
 * descriptor hash, salt, or drops. `poolID` is absent for a legacy content version that predates
 * sealed content.
 */
const RevealedNodeSchema = z.object({ id: z.string(), poolID: z.string().optional() });

/**
 * A chain's current append position: `nextSeed` is the seed a start rooting here derives its
 * first checkpoint from, and `chainIndex` is that checkpoint's position in the chain. Equal to
 * `{ genesisSeed, 0 }` for a node never yet played; advances as the avatar plays the node's chain
 * further, so a revisited node's start roots at where play actually left off rather than genesis.
 */
const NodeGenesisHeadSchema = z.object({ chainIndex: z.int().min(0), nextSeed: z.string() });

/**
 * One node's freshly minted or previously minted genesis seed, alongside its derived encounter and
 * the content version it was derived against — `revealNodes`'s per-node output. `genesisSeed` is
 * the chain's origin seed, kept for reference; `head` is the position a start at this scope must
 * actually root against. `encounterNode` and `contentVersion` are the remaining inputs
 * `buildStartHash` needs to synthesize that start's hash offline, since the encounter is derived
 * against a specific content version.
 */
const NodeGenesisSchema = z.object({
  contentVersion: z.string(),
  encounterNode: EncounterNodeSchema,
  genesisSeed: z.string(),
  head: NodeGenesisHeadSchema,
  nodeID: z.string(),
});

/**
 * `revealNodes`'s avatar- and account-global crypto stamps: the key version its avatar's activity
 * starts stamp, and the scope-secret ref/version its encounter derivation reads — the same stamps
 * every node in the batch was derived against, carried once rather than repeated per node.
 */
const RevealStampsSchema = z.object({
  keyVersion: z.int().min(1),
  secretRef: z.string(),
  secretVersion: z.int().min(1),
});

/**
 * Every addressable `first_clear` grant key the avatar holds, regardless of viewport — the
 * completed set `startActivity`'s selectable-node gate and its client mirror both evaluate against.
 */
const CompletedNodeIDsSchema = z.array(z.string());

/**
 * The activities service's API: every procedure is authed and owner-scoped through the caller's
 * avatars.
 */
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

          // Empty when `root` carries the whole request: a root-only ingest mints the row and
          // appends nothing.
          continuations: z
            .array(CatchUpContinuationSchema)
            .max(MAX_CATCH_UP_BATCH_CHECKPOINTS)
            .readonly(),
          expectedHead: z.int().min(0),

          /**
           * A client-minted root the server has never seen — offline-first ingest. Present only
           * when `activityID` names a row this request itself mints, under the same gates
           * `startActivity` runs, before the continuation loop appends onto it. Absent for the
           * ordinary case: `activityID` names a row the server already minted.
           */
          root: OfflineRootSubmissionSchema.optional(),
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
        // `root` carries the whole request, never a root-less no-op that would return the head
        // unchanged.
        .refine((input) => input.root !== undefined || input.continuations.length > 0, {
          error: 'a request with no continuations must carry a root to mint',
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
          message: "A root mint's avatar is not the account's active one",
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
          message: "A root mint's scope has no revealed chain to root against",
          status: 409,
        },
        NODE_UNKNOWN: {
          data: z.object({}),
          message: "A root mint's scope node is not registered on the world map",
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
          message: "A root mint's stamped sim version is past retention",
          status: 410,
        },
        SIM_VERSION_UNKNOWN: {
          data: SimVersionProblemDataSchema,
          message: "A root mint's stamped sim version is not registered",
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

  /**
   * Documents are immutable once published, so a fetched version never revalidates — the GET
   * marks it retry-safe.
   */
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

  /**
   * The revealed region is a projection of the avatar's verified first-clear grants, never stored
   * reveal state — recomputed fresh every call. `viewport` bounds what the response returns, never
   * what the underlying discs make eligible to disclose: a cell inside the viewport but outside
   * every disc is never in the response, regardless of viewport size.
   */
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

  /**
   * Mints (or re-affirms) the genesis chain row for each given world-map node, on the avatar's
   * behalf, so a later `startActivity` at the same scope has a chain to root against, and derives
   * that node's encounter alongside the crypto stamps a start needs — every input an offline-open
   * start synthesizes a valid activity start from without the server. Idempotent per node: a
   * repeat reveal self-assigns the existing row's `genesisSeed` rather than rolling a new one, so
   * the same node reveals to the same seed regardless of how many times or how many concurrent
   * callers reveal it. Authorization is ownership of the avatar only — whether a given node is one
   * this avatar may legitimately reveal is a separate, not-yet-enforced concern.
   */
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
        AVATAR_NOT_ACTIVE: {
          data: AvatarNotActiveDataSchema,
          message: "The account's active avatar is not the one starting",
          status: 409,
        },
        CHAIN_QUARANTINED: {
          data: z.object({}),
          message: 'The chain is quarantined pending replay adjudication',
          status: 409,
        },
        CONFLICT: {
          data: z.object({ activity: ActivityDataSchema }),
          message: 'An activity is already active for this avatar',
        },
        NODE_NOT_REVEALED: {
          data: z.object({}),
          message: 'The scope node has no revealed chain to start',
          status: 409,
        },
        NODE_UNKNOWN: {
          data: z.object({}),
          message: 'The scope node is not registered on the world map',
          status: 404,
        },
        NODE_UNREACHABLE: {
          data: z.object({}),
          message: "The scope node is outside the avatar's selectable set",
          status: 409,
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
