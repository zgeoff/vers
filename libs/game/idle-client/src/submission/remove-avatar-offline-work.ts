import { buildActivityKeyRange } from './build-activity-key-range';
import { collectOwnedActivityIDs } from './collect-owned-activity-ids';
import {
  CHECKPOINT_QUEUE_STORE_NAME,
  FAILURE_ACTION_PREFERENCE_KEY,
  LAST_STARTED_ACTIVITY_KEY,
  PENDING_ACTIVITY_STARTS_STORE_NAME,
  PENDING_STOP_INTENT_KEY,
  PREFERENCES_STORE_NAME,
} from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

export async function removeAvatarOfflineWork(avatarIDs: ReadonlyArray<string>): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const transaction = db.transaction(
    [CHECKPOINT_QUEUE_STORE_NAME, PENDING_ACTIVITY_STARTS_STORE_NAME, PREFERENCES_STORE_NAME],
    'readwrite',
  );

  const checkpointStore = transaction.objectStore(CHECKPOINT_QUEUE_STORE_NAME);
  const startStore = transaction.objectStore(PENDING_ACTIVITY_STARTS_STORE_NAME);
  const preferenceStore = transaction.objectStore(PREFERENCES_STORE_NAME);

  const [starts, checkpoints] = await Promise.all([startStore.getAll(), checkpointStore.getAll()]);

  const owned = [...collectOwnedActivityIDs({ avatarIDs, checkpoints, starts })];

  const ownedAvatarIDs = new Set(avatarIDs);

  const removeAvatarPreference = async (key: string): Promise<void> => {
    const record = await preferenceStore.get(key);

    if (record !== undefined && 'avatarID' in record && ownedAvatarIDs.has(record.avatarID)) {
      await preferenceStore.delete(key);
    }
  };

  await Promise.all([
    ...owned.map((activityID) => startStore.delete(activityID)),
    ...owned.map((activityID) => checkpointStore.delete(buildActivityKeyRange(activityID))),
    ...avatarIDs.map((avatarID) =>
      preferenceStore.delete(`${LAST_STARTED_ACTIVITY_KEY}:${avatarID}`),
    ),
    removeAvatarPreference(FAILURE_ACTION_PREFERENCE_KEY),
    removeAvatarPreference(PENDING_STOP_INTENT_KEY),
    transaction.done,
  ]);
}
