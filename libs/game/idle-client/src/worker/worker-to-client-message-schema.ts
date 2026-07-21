import { ActivityDataSchema } from '@vers/contract-activity';
import { ActivityFailureAction } from '@vers/idle-core';
import * as z from 'zod';
import { WorkerMessageType } from '../types';
import { simulationSnapshotSchema } from './simulation-snapshot-schema';

const activityCompletedMessageSchema = z
  .object({
    activityID: z.string(),
    type: z.literal(WorkerMessageType.ActivityCompleted),
  })
  .readonly();

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

const initialStateMessageSchema = z
  .object({
    rewardSlotLedger: rewardSlotLedgerSnapshotSchema,
    state: simulationSnapshotSchema,
    type: z.literal(WorkerMessageType.InitialState),
    writerDisplacedActivityID: z.string().nullable(),
  })
  .readonly();

const simulationUpdateMessageSchema = z
  .object({
    state: simulationSnapshotSchema,
    type: z.literal(WorkerMessageType.SimulationUpdate),
  })
  .readonly();

/**
 * One resync's lifecycle as tabs observe it, in the terms `run-resync-flow` broadcasts them.
 */
const resyncStatusSchema = z.discriminatedUnion('kind', [
  z.object({ attempts: z.int(), kind: z.literal('done'), levelUps: z.int() }).readonly(),
  z.object({ attempts: z.int(), kind: z.literal('fast-forwarding'), levelUps: z.int() }).readonly(),
  z.object({ activityID: z.string(), kind: z.literal('active-elsewhere') }).readonly(),
  z.object({ avatarID: z.string(), kind: z.literal('failed') }).readonly(),
  z.object({ avatarID: z.string(), kind: z.literal('session-expired') }).readonly(),
  z.object({ kind: z.literal('capped') }).readonly(),
]);

const resyncStatusMessageSchema = z
  .object({
    status: resyncStatusSchema,
    type: z.literal(WorkerMessageType.ResyncStatus),
  })
  .readonly();

const connectionStatusMessageSchema = z
  .object({
    online: z.boolean(),
    type: z.literal(WorkerMessageType.ConnectionStatus),
  })
  .readonly();

const failureActionStatusMessageSchema = z
  .object({
    failureAction: z.enum(ActivityFailureAction),
    type: z.literal(WorkerMessageType.FailureActionStatus),
  })
  .readonly();

const checkpointFlushStalledMessageSchema = z
  .object({
    activityID: z.string(),
    reason: z.string(),
    traceID: z.string(),
    type: z.literal(WorkerMessageType.CheckpointFlushStalled),
  })
  .readonly();

const checkpointStreamInvalidMessageSchema = z
  .object({
    activityID: z.string(),
    reason: z.string(),
    traceID: z.string().exactOptional(),
    type: z.literal(WorkerMessageType.CheckpointStreamInvalid),
  })
  .readonly();

const offlineCapStatusMessageSchema = z
  .object({
    halted: z.boolean(),
    remainingMs: z.number(),
    type: z.literal(WorkerMessageType.OfflineCapStatus),
  })
  .readonly();

const rewardSlotsRecordedMessageSchema = z
  .object({
    activityID: z.string(),
    rewardSlotCount: z.int(),
    type: z.literal(WorkerMessageType.RewardSlotsRecorded),
    version: z.int(),
  })
  .readonly();

/**
 * One start request's outcome, in the terms `handle-start-activity-message` broadcasts them.
 */
const startStatusSchema = z.discriminatedUnion('kind', [
  z.object({ activity: ActivityDataSchema, kind: z.literal('started') }).readonly(),
  z.object({ activityID: z.string(), kind: z.literal('attached') }).readonly(),
  z.object({ kind: z.literal('failed') }).readonly(),
]);

const startStatusMessageSchema = z
  .object({
    requestID: z.string(),
    status: startStatusSchema,
    type: z.literal(WorkerMessageType.StartStatus),
  })
  .readonly();

const writerDisplacedMessageSchema = z
  .object({
    activityID: z.string().nullable(),
    type: z.literal(WorkerMessageType.WriterDisplaced),
  })
  .readonly();

/**
 * Broadcast by an elected fallback writer the moment it is ready to serve, first election and
 * every succession alike; the SharedWorker path never emits it. Tabs respond by resetting their
 * handshake state and re-sending initialize and report-online, so a promoted writer that booted
 * with no session context receives it fresh.
 */
const writerReadyMessageSchema = z
  .object({
    type: z.literal(WorkerMessageType.WriterReady),
  })
  .readonly();

/**
 * Every message the worker may post to a connected tab across the shared-worker boundary.
 */
export const workerToClientMessageSchema = z.discriminatedUnion('type', [
  activityCompletedMessageSchema,
  checkpointFlushStalledMessageSchema,
  checkpointStreamInvalidMessageSchema,
  connectionStatusMessageSchema,
  failureActionStatusMessageSchema,
  initialStateMessageSchema,
  offlineCapStatusMessageSchema,
  resyncStatusMessageSchema,
  rewardSlotsRecordedMessageSchema,
  simulationUpdateMessageSchema,
  startStatusMessageSchema,
  writerDisplacedMessageSchema,
  writerReadyMessageSchema,
]);

export type WorkerMessage = z.infer<typeof workerToClientMessageSchema>;

export type ActivityCompletedMessage = z.infer<typeof activityCompletedMessageSchema>;

export type CheckpointFlushStalledMessage = z.infer<typeof checkpointFlushStalledMessageSchema>;

export type CheckpointStreamInvalidMessage = z.infer<typeof checkpointStreamInvalidMessageSchema>;

export type ConnectionStatusMessage = z.infer<typeof connectionStatusMessageSchema>;

export type FailureActionStatusMessage = z.infer<typeof failureActionStatusMessageSchema>;

export type InitialStateMessage = z.infer<typeof initialStateMessageSchema>;

export type OfflineCapStatusMessage = z.infer<typeof offlineCapStatusMessageSchema>;

export type ResyncStatus = z.infer<typeof resyncStatusSchema>;

export type ResyncStatusMessage = z.infer<typeof resyncStatusMessageSchema>;

export type RewardSlotLedgerEntry = z.infer<typeof rewardSlotLedgerEntrySchema>;

export type RewardSlotLedgerSnapshot = z.infer<typeof rewardSlotLedgerSnapshotSchema>;

export type RewardSlotsRecordedMessage = z.infer<typeof rewardSlotsRecordedMessageSchema>;

export type SimulationUpdateMessage = z.infer<typeof simulationUpdateMessageSchema>;

export type StartStatus = z.infer<typeof startStatusSchema>;

export type StartStatusMessage = z.infer<typeof startStatusMessageSchema>;

export type WriterDisplacedMessage = z.infer<typeof writerDisplacedMessageSchema>;

export type WriterReadyMessage = z.infer<typeof writerReadyMessageSchema>;
