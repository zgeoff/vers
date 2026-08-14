import { PREFERENCES_STORE_NAME, START_STAMPS_KEY } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { StartStampsPreference } from './types';

/**
 * Persists `revealNodes`'s crypto stamps, dropping a write whose stamps are strictly older than the
 * cached ones. Overlapping reveal batches can settle out of order, so a late response may carry an
 * older pair than one already cached; comparing the incoming pair against the cached one —
 * `keyVersion` first, then `secretVersion` — inside a single read-compare-write transaction
 * serializes concurrent writers and keeps the newest pair. An equal-or-newer pair overwrites.
 */
export async function writeStartStamps(stamps: Readonly<StartStampsPreference>): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction(PREFERENCES_STORE_NAME, 'readwrite');

  const cached = await tx.store.get(START_STAMPS_KEY);

  if (cached === undefined || !('keyVersion' in cached) || !isOlderThan(stamps, cached)) {
    await tx.store.put(stamps, START_STAMPS_KEY);
  }

  await tx.done;
}

/**
 * Whether `incoming` stamps are strictly older than `cached`: a lower `keyVersion`, or the same
 * `keyVersion` with a lower `secretVersion`. An equal-or-newer pair is not older, so it overwrites.
 */
function isOlderThan(
  incoming: Readonly<StartStampsPreference>,
  cached: Readonly<StartStampsPreference>,
): boolean {
  if (incoming.keyVersion !== cached.keyVersion) {
    return incoming.keyVersion < cached.keyVersion;
  }

  return incoming.secretVersion < cached.secretVersion;
}
