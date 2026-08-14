import type { IDBPDatabase } from 'idb';
import {
  CHECKPOINT_QUEUE_STORE_NAME,
  CONTENT_DOCUMENT_STORE_NAME,
  NODE_SEEDS_STORE_NAME,
  PREFERENCES_STORE_NAME,
} from './constants';
import type { CheckpointQueueSchema } from './types';

/**
 * Creates every object store the worker's durable cache needs on a fresh open or a version upgrade:
 * `pending-checkpoints` keyed `[activityID, version]`, so an activity's rows sort in submission
 * order and a compound read/delete addresses either a single checkpoint or an activity's whole
 * range; `preferences` caches device-local settings — a SharedWorker has no `localStorage` — as the
 * offline outbox for a server source of truth; `content-documents` caches published content by
 * `contentVersion`; `node-seeds` caches a revealed world-map node's genesis seed by its
 * `[avatarID, nodeID]` pair. Each store is created only if missing, so an upgrade from an earlier
 * version adds the stores that version lacks without dropping the ones it already holds or their
 * rows.
 */
export function upgradeCheckpointQueueDB(database: IDBPDatabase<CheckpointQueueSchema>): void {
  if (!database.objectStoreNames.contains(CHECKPOINT_QUEUE_STORE_NAME)) {
    database.createObjectStore(CHECKPOINT_QUEUE_STORE_NAME, {
      keyPath: ['activityID', 'version'],
    });
  }

  if (!database.objectStoreNames.contains(PREFERENCES_STORE_NAME)) {
    database.createObjectStore(PREFERENCES_STORE_NAME);
  }

  if (!database.objectStoreNames.contains(CONTENT_DOCUMENT_STORE_NAME)) {
    database.createObjectStore(CONTENT_DOCUMENT_STORE_NAME, { keyPath: 'contentVersion' });
  }

  if (!database.objectStoreNames.contains(NODE_SEEDS_STORE_NAME)) {
    database.createObjectStore(NODE_SEEDS_STORE_NAME, { keyPath: ['avatarID', 'nodeID'] });
  }
}
