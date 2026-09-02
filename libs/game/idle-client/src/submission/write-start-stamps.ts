import { PREFERENCES_STORE_NAME, START_STAMPS_KEY } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { StartStampsPreference } from './types';

export async function writeStartStamps(stamps: Readonly<StartStampsPreference>): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction(PREFERENCES_STORE_NAME, 'readwrite');

  // Overlapping reveal batches can settle out of order, so a late response may carry an older pair
  // than one already cached. A single read-compare-write transaction serializes concurrent writers
  // and keeps the newest pair.
  const cached = await tx.store.get(START_STAMPS_KEY);

  if (cached === undefined || !('keyVersion' in cached) || !isOlderThan(stamps, cached)) {
    await tx.store.put(stamps, START_STAMPS_KEY);
  }

  await tx.done;
}

function isOlderThan(
  incoming: Readonly<StartStampsPreference>,
  cached: Readonly<StartStampsPreference>,
): boolean {
  if (incoming.keyVersion !== cached.keyVersion) {
    return incoming.keyVersion < cached.keyVersion;
  }

  return incoming.secretVersion < cached.secretVersion;
}
