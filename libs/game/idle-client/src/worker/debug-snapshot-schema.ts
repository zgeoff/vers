import * as z from 'zod';

const debugEventSchema = z
  .object({ at: z.number(), detail: z.string(), type: z.string() })
  .readonly();

const flushRecordSchema = z
  .object({
    appendedHead: z.int().nullable(),
    at: z.number(),
    reason: z.string().nullable(),
    type: z.string(),
  })
  .readonly();

const startRefusalSchema = z.object({ code: z.string(), reason: z.string().nullable() }).readonly();

const pendingActivityStartSchema = z
  .object({
    activityID: z.string(),
    attempts: z.int().min(0),
    avatarID: z.string(),
    deferredUntil: z.number().nullable(),
    lastAttemptAt: z.number().nullable(),
    lastOutcome: z.string().nullable(),
    lastRefusal: startRefusalSchema.nullable(),
    predecessorActivityID: z.string().nullable(),
    scopeID: z.string(),
  })
  .readonly();

const submitterStateSchema = z
  .object({
    expectedHead: z.int(),
    latestQueuedVersion: z.int().nullable(),
    retryAttempt: z.int(),
    retryDelayMs: z.number().nullable(),
    state: z.string(),
  })
  .readonly();

const pendingCheckpointsSchema = z
  .object({
    activityID: z.string(),
    count: z.int().min(1),
    deferredUntil: z.number().nullable(),
    highestVersion: z.int(),
    lastFlush: flushRecordSchema.nullable(),
    submitter: submitterStateSchema.nullable(),
  })
  .readonly();

const liveRunSnapshotSchema = z
  .object({
    activityID: z.string(),
    appendedHead: z.int().nullable(),
    avatarID: z.string(),
    lastFlush: flushRecordSchema.nullable(),
    scopeID: z.string(),
    scopeType: z.string(),
  })
  .readonly();

const latestRunSnapshotSchema = z
  .object({
    activityID: z.string(),
    avatarID: z.string(),
    baselineXP: z.number(),
    deltaXP: z.number(),
  })
  .readonly();

export const debugSnapshotSchema = z
  .object({
    capturedAt: z.number(),
    connectivityOnline: z.boolean(),
    events: z.array(debugEventSchema).readonly(),
    latestRun: latestRunSnapshotSchema.nullable(),
    liveRun: liveRunSnapshotSchema.nullable(),
    outbox: z
      .object({
        activityStarts: z.array(pendingActivityStartSchema).readonly(),
        checkpoints: z.array(pendingCheckpointsSchema).readonly(),
      })
      .readonly(),
    phase: z.string(),
    simulationSpeed: z.int().min(1),
    writer: z.object({ bootedAt: z.number(), workerID: z.string() }).readonly(),
  })
  .readonly();

export type WorkerDebugSnapshot = z.infer<typeof debugSnapshotSchema>;
