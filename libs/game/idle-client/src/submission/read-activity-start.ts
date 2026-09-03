import type { ActivityData } from '@vers/contract-activity';
import { PENDING_ACTIVITY_STARTS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

export async function readActivityStart(activityID: string): Promise<ActivityData | undefined> {
  const db = await resolveCheckpointQueueDB();

  return db.get(PENDING_ACTIVITY_STARTS_STORE_NAME, activityID);
}
