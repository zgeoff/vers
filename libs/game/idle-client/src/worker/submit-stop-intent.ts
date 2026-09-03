import type { ActivityData } from '@vers/contract-activity';
import { writePendingStopIntent } from '../submission/write-pending-stop-intent';
import { flushPendingStop } from './flush-pending-stop';
import type { WorkerContext } from './types';

export async function submitStopIntent(
  context: WorkerContext,
  row: Readonly<Pick<ActivityData, 'avatarID' | 'id'>>,
): Promise<void> {
  await writePendingStopIntent({ activityID: row.id, avatarID: row.avatarID });
  await flushPendingStop(context);
}
