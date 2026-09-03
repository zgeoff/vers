import { isDefinedError, safe } from '@orpc/client';
import { readPendingStopIntent } from '../submission/read-pending-stop-intent';
import { removePendingStopIntent } from '../submission/remove-pending-stop-intent';
import type { WorkerContext } from './types';

export type PendingStopFlushOutcome = 'delivered' | 'none' | 'undelivered';

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

  const superseded =
    isDefinedError(error) && (error.code === 'NOT_FOUND' || error.code === 'SESSION_EVICTED');

  if (error !== null && !superseded) {
    return 'undelivered';
  }

  await removePendingStopIntent(intent.activityID);

  return 'delivered';
}
