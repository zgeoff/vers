import type { ActivityData } from '@vers/contract-activity';
import { PENDING_ACTIVITY_STARTS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

export async function readAllActivityStarts(): Promise<ReadonlyArray<ActivityData>> {
  const db = await resolveCheckpointQueueDB();

  return db.getAll(PENDING_ACTIVITY_STARTS_STORE_NAME);
}
