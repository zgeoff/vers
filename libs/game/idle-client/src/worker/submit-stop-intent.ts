import type { ActivityData } from '@vers/contract-activity';
import { writePendingStopIntent } from '../submission/write-pending-stop-intent';
import { flushPendingStop } from './flush-pending-stop';
import type { WorkerContext } from './types';

/**
 * Accepts a stop for the given row into the durable intent record and attempts its delivery now —
 * the tail every stop shares, whether the player raised it or a lifecycle flow is stopping back a
 * row it minted after losing the runtime. An undelivered intent stays held for the next
 * reconnect or resync entry to retry.
 */
export async function submitStopIntent(
  context: WorkerContext,
  row: Readonly<Pick<ActivityData, 'avatarID' | 'id'>>,
): Promise<void> {
  await writePendingStopIntent({ activityID: row.id, avatarID: row.avatarID });
  await flushPendingStop(context);
}
