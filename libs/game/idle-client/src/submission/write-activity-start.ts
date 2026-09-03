import type { ActivityData } from '@vers/contract-activity';
import { PENDING_ACTIVITY_STARTS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

export async function writeActivityStart(row: Readonly<ActivityData>): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.put(PENDING_ACTIVITY_STARTS_STORE_NAME, row);
}
