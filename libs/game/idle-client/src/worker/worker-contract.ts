import { oc } from '@orpc/contract';
import { ActivityDataSchema, EncounterNodeSchema } from '@vers/contract-activity';
import { ActivityFailureAction } from '@vers/idle-core';
import * as z from 'zod';
import { simulationSnapshotSchema } from './simulation-snapshot-schema';

const rewardSlotLedgerEntrySchema = z
  .object({
    count: z.int(),
    version: z.int(),
  })
  .readonly();

const rewardSlotLedgerSnapshotSchema = z
  .object({
    activityID: z.string().nullable(),
    entries: z.array(rewardSlotLedgerEntrySchema).readonly(),
  })
  .readonly();

const initializeOutputSchema = z
  .object({
    rewardSlotLedger: rewardSlotLedgerSnapshotSchema,
    state: simulationSnapshotSchema,
    writerDisplacedActivityID: z.string().nullable(),
  })
  .readonly();

/**
 * One start call's outcome, answered directly rather than correlated over a broadcast.
 */
const startStatusSchema = z.discriminatedUnion('kind', [
  z.object({ activity: ActivityDataSchema, kind: z.literal('started') }).readonly(),
  z.object({ activityID: z.string(), kind: z.literal('attached') }).readonly(),
  z.object({ kind: z.literal('failed') }).readonly(),
]);

const ackSchema = z.object({ ok: z.literal(true) }).readonly();

const nodeSeedAnchorSchema = z
  .object({ chainIndex: z.int().min(0), nextSeed: z.string() })
  .readonly();

const nodeSeedSchema = z
  .object({
    contentVersion: z.string(),
    encounterNode: EncounterNodeSchema,
    genesisSeed: z.string(),
    anchor: nodeSeedAnchorSchema,
    nodeID: z.string(),
  })
  .readonly();

/**
 * `revealNodes`'s avatar- and account-global crypto stamps, relayed alongside a `cacheNodeSeeds`
 * batch so the worker's durable cache holds every input an offline-open start needs.
 */
const startStampsSchema = z
  .object({ keyVersion: z.int().min(1), secretRef: z.string(), secretVersion: z.int().min(1) })
  .readonly();

/**
 * The worker's in-page RPC surface, called over a `MessagePort` (a real `SharedWorker` port, or a
 * structural port bridging a tab to the elected web-locks writer). Package-internal: no
 * `authedRoute`, no `.errors()` maps — the underlying activity-service client already carries auth,
 * and a worker-side fault reports rather than rejecting the caller.
 */
export const workerContract = {
  cacheNodeSeeds: oc
    .input(
      z
        .object({
          avatarID: z.string(),
          seeds: z.array(nodeSeedSchema).readonly(),
          stamps: startStampsSchema,
        })
        .readonly(),
    )
    .output(ackSchema),

  disconnect: oc.input(z.object({}).readonly()).output(ackSchema),

  initialize: oc.input(z.object({}).readonly()).output(initializeOutputSchema),

  reportOnline: oc
    .input(z.object({ avatarID: z.string(), claim: z.boolean() }).readonly())
    .output(ackSchema),

  setFailureAction: oc
    .input(
      z.object({ avatarID: z.string(), failureAction: z.enum(ActivityFailureAction) }).readonly(),
    )
    .output(z.object({ failureAction: z.enum(ActivityFailureAction) }).readonly()),

  startActivity: oc
    .input(
      z.object({ avatarID: z.string(), scopeID: z.string(), scopeType: z.string() }).readonly(),
    )
    .output(startStatusSchema),

  stopActivity: oc
    .input(z.object({ activityID: z.string(), avatarID: z.string() }).readonly())
    .output(ackSchema),
};

export type WorkerContract = typeof workerContract;

export type InitializeOutput = z.infer<typeof initializeOutputSchema>;

export type RewardSlotLedgerEntry = z.infer<typeof rewardSlotLedgerEntrySchema>;

export type RewardSlotLedgerSnapshot = z.infer<typeof rewardSlotLedgerSnapshotSchema>;

export type StartStatus = z.infer<typeof startStatusSchema>;
