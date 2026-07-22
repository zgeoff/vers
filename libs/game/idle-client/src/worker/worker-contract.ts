import { oc } from '@orpc/contract';
import { ActivityDataSchema } from '@vers/contract-activity';
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
  z
    .object({
      activeAvatarName: z.string().optional(),
      kind: z.literal('failed'),
      reason: z.literal('avatar-not-active').optional(),
    })
    .readonly(),
]);

const ackSchema = z.object({ ok: z.literal(true) }).readonly();

/**
 * The worker's in-page RPC surface, called over a `MessagePort` (a real `SharedWorker` port, or a
 * structural port bridging a tab to the elected web-locks writer). Package-internal: no
 * `authedRoute`, no `.errors()` maps — the underlying activity-service client already carries auth,
 * and a worker-side fault reports rather than rejecting the caller.
 */
export const workerContract = {
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
