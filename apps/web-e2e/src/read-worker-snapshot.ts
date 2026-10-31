import type { Page } from '@playwright/test';
import * as z from 'zod';

interface QADebugHook {
  readonly setSpeed: (speed: number) => Promise<number>;
  readonly snapshot: () => Promise<unknown>;
}

declare global {
  var __versQA: QADebugHook | undefined;
}

const DebugEventSchema = z.object({ at: z.number(), detail: z.string(), type: z.string() });
const ActivityReferenceSchema = z.object({ activityID: z.string() });
const FlushRecordSchema = z.object({ type: z.string() });

const QueuedCheckpointsSchema = z.object({
  activityID: z.string(),
  highestVersion: z.int(),
  lastFlush: FlushRecordSchema.nullable(),
});

const WorkerSnapshotSchema = z.object({
  connectivityOnline: z.boolean(),
  events: z.array(DebugEventSchema),
  liveRun: ActivityReferenceSchema.extend({ scopeID: z.string() }).nullable(),
  outbox: z.object({
    activityStarts: z.array(ActivityReferenceSchema),
    checkpoints: z.array(QueuedCheckpointsSchema),
  }),
  phase: z.string(),
  tab: z.object({ tabID: z.string() }),
  writer: z.object({ workerID: z.string() }),
});

export type WorkerSnapshot = z.infer<typeof WorkerSnapshotSchema>;

const UnansweredSnapshotSchema = z.object({ workerError: z.string() });

// app-web installs the hook only on a game page of a QA-domain account, and only once the page has
// a worker client, so a page that is still mounting answers null, and so does a worker too busy to
// answer within the hook's wait
export async function readWorkerSnapshot(page: Page): Promise<WorkerSnapshot | null> {
  const snapshot = await page.evaluate(async () => {
    const answered = await globalThis.__versQA?.snapshot();

    return answered ?? null;
  });

  if (snapshot === null || UnansweredSnapshotSchema.safeParse(snapshot).success) {
    return null;
  }

  return WorkerSnapshotSchema.parse(snapshot);
}
