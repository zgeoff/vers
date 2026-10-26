import type { ActivityData } from '@vers/contract-activity';
import {
  LAST_STARTED_ACTIVITY_KEY,
  PENDING_ACTIVITY_STARTS_STORE_NAME,
  PREFERENCES_STORE_NAME,
} from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import { runAtomicWrites } from './run-atomic-writes';

export async function writeMintedActivityStart(row: Readonly<ActivityData>): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction(
    [PENDING_ACTIVITY_STARTS_STORE_NAME, PREFERENCES_STORE_NAME],
    'readwrite',
  );

  await runAtomicWrites(tx, [
    () =>
      tx
        .objectStore(PREFERENCES_STORE_NAME)
        .put(
          { avatarID: row.avatarID, lastActivityID: row.id },
          `${LAST_STARTED_ACTIVITY_KEY}:${row.avatarID}`,
        ),
    () => tx.objectStore(PENDING_ACTIVITY_STARTS_STORE_NAME).put(row),
  ]);
}
