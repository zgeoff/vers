import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

export async function readCachedNodeIDs(avatarID: string): Promise<ReadonlySet<string>> {
  const db = await resolveCheckpointQueueDB();

  // the compound key is range-read over the avatar's bound alone
  const keys = await db.getAllKeys(
    NODE_SEEDS_STORE_NAME,
    IDBKeyRange.bound([avatarID], [avatarID, []]),
  );

  return new Set(keys.map((key) => key[1]));
}
