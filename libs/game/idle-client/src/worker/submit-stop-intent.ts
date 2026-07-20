import type { ActivityData } from '@vers/contract-activity';
import { writePendingStopIntent } from '../submission/write-pending-stop-intent';
import { flushPendingStop } from './flush-pending-stop';
import type { WorkerContext } from './types';

/**
 * Holds a stop for the given row durably and attempts delivery now — the tail every stop shares.
 * An undelivered intent stays held for the next reconnect or resync entry to retry.
 */
export async function submitStopIntent(
  context: WorkerContext,
  row: Readonly<Pick<ActivityData, 'avatarID' | 'id'>>,
): Promise<void> {
  await writePendingStopIntent({ activityID: row.id, avatarID: row.avatarID });
  await flushPendingStop(context);
}
