import { oc } from '@orpc/contract';
import { ActivityDataSchema, EncounterNodeSchema, QA_SIM_SPEED_MAX } from '@vers/contract-activity';
import { ActivityFailureAction } from '@vers/idle-core';
import * as z from 'zod';
import { debugSnapshotSchema } from './debug-snapshot-schema';
import { liveRunSchema } from './live-run-schema';
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
    liveRun: liveRunSchema.exactOptional(),
    rewardSlotLedger: rewardSlotLedgerSnapshotSchema,
    simulationSpeed: z.int().min(1),
    state: simulationSnapshotSchema,
    writerDisplacedActivityID: z.string().nullable(),
  })
  .readonly();

const startStatusSchema = z.discriminatedUnion('kind', [
  z.object({ activity: ActivityDataSchema, kind: z.literal('started') }).readonly(),
  z.object({ activityID: z.string(), kind: z.literal('attached') }).readonly(),
  z.object({ kind: z.literal('failed') }).readonly(),
]);

const ackSchema = z.object({ ok: z.literal(true) }).readonly();

const undeliveredWorkInputSchema = z
  .object({ avatarIDs: z.array(z.string()).readonly() })
  .readonly();

const simulationSpeedStatusSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('applied'), speed: z.int().min(1) }).readonly(),
  z.object({ kind: z.literal('refused'), reason: z.literal('avatar-not-qa') }).readonly(),
]);

const undeliveredWorkSchema = z
  .object({ activityCount: z.int().min(0), playMs: z.number().min(0) })
  .readonly();

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

const startStampsSchema = z
  .object({ keyVersion: z.int().min(1), secretRef: z.string(), secretVersion: z.int().min(1) })
  .readonly();

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

  readDebugSnapshot: oc.input(z.object({}).readonly()).output(debugSnapshotSchema),

  readUndeliveredWork: oc.input(undeliveredWorkInputSchema).output(undeliveredWorkSchema),

  removeUndeliveredWork: oc.input(undeliveredWorkInputSchema).output(ackSchema),

  reportOnline: oc
    .input(z.object({ avatarID: z.string(), claim: z.boolean() }).readonly())
    .output(ackSchema),

  setFailureAction: oc
    .input(
      z.object({ avatarID: z.string(), failureAction: z.enum(ActivityFailureAction) }).readonly(),
    )
    .output(z.object({ failureAction: z.enum(ActivityFailureAction) }).readonly()),

  setSimulationSpeed: oc
    .input(
      z.object({ isQAAvatar: z.boolean(), speed: z.int().min(1).max(QA_SIM_SPEED_MAX) }).readonly(),
    )
    .output(simulationSpeedStatusSchema),

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

export type SimulationSpeedStatus = z.infer<typeof simulationSpeedStatusSchema>;

export type StartStatus = z.infer<typeof startStatusSchema>;

export type UndeliveredWork = z.infer<typeof undeliveredWorkSchema>;

export type UndeliveredWorkInput = z.infer<typeof undeliveredWorkInputSchema>;
