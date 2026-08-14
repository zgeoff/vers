import type { IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import {
  CHECKPOINT_QUEUE_STORE_NAME,
  CONTENT_DOCUMENT_STORE_NAME,
  NODE_SEEDS_STORE_NAME,
  PREFERENCES_STORE_NAME,
} from './constants';
import type { CheckpointQueueSchema } from './types';

/**
 * Creates every object store the worker's durable cache needs on a fresh open or a version
 * upgrade. Each store is created only if missing, so an upgrade from an earlier version adds the
 * stores that version lacks without dropping the ones it already holds or their rows. The one
 * exception is `node-seeds`: an upgrade from a version predating v5 clears it, since its earlier
 * rows carried only a genesis seed and miss the encounter and content version a v5 row declares —
 * clearing the rebuildable cache leaves only full-shape rows behind, and the prefetch re-reveals
 * and repopulates them.
 */
export function upgradeCheckpointQueueDB(
  database: IDBPDatabase<CheckpointQueueSchema>,
  oldVersion: number,
  _newVersion: number | null,
  transaction: IDBPTransaction<
    CheckpointQueueSchema,
    Array<StoreNames<CheckpointQueueSchema>>,
    'versionchange'
  >,
): void {
  // `pending-checkpoints` keyed `[activityID, version]`, so an activity's rows sort in submission
  // order and a compound read/delete addresses either a single checkpoint or an activity's whole
  // range.
  if (!database.objectStoreNames.contains(CHECKPOINT_QUEUE_STORE_NAME)) {
    database.createObjectStore(CHECKPOINT_QUEUE_STORE_NAME, {
      keyPath: ['activityID', 'version'],
    });
  }

  // `preferences` caches device-local settings — a SharedWorker has no `localStorage` — as the
  // offline outbox for a server source of truth.
  if (!database.objectStoreNames.contains(PREFERENCES_STORE_NAME)) {
    database.createObjectStore(PREFERENCES_STORE_NAME);
  }

  // `content-documents` caches published content by `contentVersion`.
  if (!database.objectStoreNames.contains(CONTENT_DOCUMENT_STORE_NAME)) {
    database.createObjectStore(CONTENT_DOCUMENT_STORE_NAME, { keyPath: 'contentVersion' });
  }

  // `node-seeds` caches a revealed world-map node's start inputs — genesis seed, encounter, and
  // content version — by its `[avatarID, nodeID]` pair.
  if (!database.objectStoreNames.contains(NODE_SEEDS_STORE_NAME)) {
    database.createObjectStore(NODE_SEEDS_STORE_NAME, { keyPath: ['avatarID', 'nodeID'] });
  } else if (oldVersion < 5) {
    void transaction.objectStore(NODE_SEEDS_STORE_NAME).clear();
  }
}
