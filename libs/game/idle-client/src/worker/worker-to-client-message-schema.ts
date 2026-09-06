import { ActivityFailureAction } from '@vers/idle-core';
import * as z from 'zod';
import { WorkerMessageType } from '../types';
import { liveRunSchema } from './live-run-schema';
import { simulationSnapshotSchema } from './simulation-snapshot-schema';

const activityCompletedMessageSchema = z
  .object({
    activityID: z.string(),
    type: z.literal(WorkerMessageType.ActivityCompleted),
  })
  .readonly();

const activityStartIngestedMessageSchema = z
  .object({
    activityID: z.string(),
    type: z.literal(WorkerMessageType.ActivityStartIngested),
  })
  .readonly();

const simulationUpdateMessageSchema = z
  .object({
    liveRun: liveRunSchema.exactOptional(),
    state: simulationSnapshotSchema,
    type: z.literal(WorkerMessageType.SimulationUpdate),
  })
  .readonly();

const resyncStatusSchema = z.discriminatedUnion('kind', [
  z.object({ attempts: z.int(), kind: z.literal('done'), levelUps: z.int() }).readonly(),
  z.object({ attempts: z.int(), kind: z.literal('fast-forwarding'), levelUps: z.int() }).readonly(),
  z.object({ activityID: z.string(), kind: z.literal('active-elsewhere') }).readonly(),
  z
    .object({
      activeAvatarName: z.string(),
      attempts: z.int(),
      kind: z.literal('avatar-switched'),
      levelUps: z.int(),
    })
    .readonly(),
  z.object({ avatarID: z.string(), kind: z.literal('failed') }).readonly(),
  z.object({ avatarID: z.string(), kind: z.literal('session-expired') }).readonly(),
  z.object({ kind: z.literal('capped') }).readonly(),
  z.object({ kind: z.literal('sim-version-expired') }).readonly(),
]);

const resyncStatusMessageSchema = z
  .object({
    status: resyncStatusSchema,
    type: z.literal(WorkerMessageType.ResyncStatus),
  })
  .readonly();

const failureActionStatusMessageSchema = z
  .object({
    failureAction: z.enum(ActivityFailureAction),
    type: z.literal(WorkerMessageType.FailureActionStatus),
  })
  .readonly();

const checkpointStreamInvalidMessageSchema = z
  .object({
    activityID: z.string(),
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

const writerDisplacedMessageSchema = z
  .object({
    activityID: z.string().nullable(),
    type: z.literal(WorkerMessageType.WriterDisplaced),
  })
  .readonly();

const writerReadyMessageSchema = z
  .object({
    type: z.literal(WorkerMessageType.WriterReady),
  })
  .readonly();

export const workerToClientMessageSchema = z.discriminatedUnion('type', [
  activityCompletedMessageSchema,
  activityStartIngestedMessageSchema,
  checkpointStreamInvalidMessageSchema,
  failureActionStatusMessageSchema,
  offlineCapStatusMessageSchema,
  resyncStatusMessageSchema,
  rewardSlotsRecordedMessageSchema,
  simulationUpdateMessageSchema,
  writerDisplacedMessageSchema,
  writerReadyMessageSchema,
]);

export type WorkerMessage = z.infer<typeof workerToClientMessageSchema>;

export type ActivityCompletedMessage = z.infer<typeof activityCompletedMessageSchema>;

export type ActivityStartIngestedMessage = z.infer<typeof activityStartIngestedMessageSchema>;

export type CheckpointStreamInvalidMessage = z.infer<typeof checkpointStreamInvalidMessageSchema>;

export type FailureActionStatusMessage = z.infer<typeof failureActionStatusMessageSchema>;

export type OfflineCapStatusMessage = z.infer<typeof offlineCapStatusMessageSchema>;

export type ResyncStatus = z.infer<typeof resyncStatusSchema>;

export type ResyncStatusMessage = z.infer<typeof resyncStatusMessageSchema>;

export type RewardSlotsRecordedMessage = z.infer<typeof rewardSlotsRecordedMessageSchema>;

export type SimulationUpdateMessage = z.infer<typeof simulationUpdateMessageSchema>;

export type WriterDisplacedMessage = z.infer<typeof writerDisplacedMessageSchema>;

export type WriterReadyMessage = z.infer<typeof writerReadyMessageSchema>;
