import { isDefinedError, safe } from '@orpc/client';
import { readPendingStopIntent } from '../submission/read-pending-stop-intent';
import { removePendingStopIntent } from '../submission/remove-pending-stop-intent';
import type { WorkerContext } from './types';

export type PendingStopFlushOutcome = 'delivered' | 'none' | 'undelivered';

/**
 * Attempts delivery of the held stop intent: the stopped activity's queued checkpoints flush
 * first — the server rejects appends onto a stopped row, so delivering the stop before the queue
 * drains would discard progress the player already earned — then the targeted server stop lands.
 * `NOT_FOUND` counts as delivered: the row is gone or was never this caller's, and no retry can
 * change that. A transport failure or any other rejection leaves the intent held for the next
 * attempt and reports `undelivered`, which callers about to plan a resync must treat as a hard
 * gate — planning against a row the server still reads as active would revive the stopped run.
 */
export async function flushPendingStop(context: WorkerContext): Promise<PendingStopFlushOutcome> {
  const intent = await readPendingStopIntent();

  if (intent === undefined) {
    return 'none';
  }

  await context.getSubmitter().flushNow(intent.activityID);

  const [error] = await safe(
    context.getClient().stopActivity({
      activityID: intent.activityID,
      avatarID: intent.avatarID,
    }),
  );

  if (error !== null && !(isDefinedError(error) && error.code === 'NOT_FOUND')) {
    return 'undelivered';
  }

  await removePendingStopIntent(intent.activityID);

  return 'delivered';
}
