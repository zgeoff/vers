import type { ActivityData } from '@vers/contract-activity';
import {
  LAST_STARTED_ACTIVITY_KEY,
  PENDING_ACTIVITY_STARTS_STORE_NAME,
  PREFERENCES_STORE_NAME,
} from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import { runAtomicWrites } from './run-atomic-writes';

export async function removeMintedActivityStart(row: Readonly<ActivityData>): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction(
    [PENDING_ACTIVITY_STARTS_STORE_NAME, PREFERENCES_STORE_NAME],
    'readwrite',
  );

  const preferences = tx.objectStore(PREFERENCES_STORE_NAME);
  const key = `${LAST_STARTED_ACTIVITY_KEY}:${row.avatarID}`;
  const predecessorID = row.predecessorActivityID;

  await runAtomicWrites(tx, [
    () => tx.objectStore(PENDING_ACTIVITY_STARTS_STORE_NAME).delete(row.id),
    predecessorID === null
      ? () => preferences.delete(key)
      : () => preferences.put({ avatarID: row.avatarID, lastActivityID: predecessorID }, key),
  ]);
}
