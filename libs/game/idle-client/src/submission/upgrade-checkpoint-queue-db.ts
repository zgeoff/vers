import type { IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import {
  CHECKPOINT_QUEUE_STORE_NAME,
  CONTENT_DOCUMENT_STORE_NAME,
  LEGACY_PENDING_ACTIVITY_STARTS_STORE_NAME,
  NODE_SEEDS_STORE_NAME,
  PENDING_ACTIVITY_STARTS_STORE_NAME,
  PREFERENCES_STORE_NAME,
} from './constants';
import type { CheckpointQueueSchema } from './types';

export function upgradeCheckpointQueueDB(
  database: IDBPDatabase<CheckpointQueueSchema>,
  _oldVersion: number,
  _newVersion: number | null,
  _transaction: IDBPTransaction<
    CheckpointQueueSchema,
    Array<StoreNames<CheckpointQueueSchema>>,
    'versionchange'
  >,
): void {
  removeLegacyOutbox(database);

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
  }

  if (!database.objectStoreNames.contains(PENDING_ACTIVITY_STARTS_STORE_NAME)) {
    database.createObjectStore(PENDING_ACTIVITY_STARTS_STORE_NAME, { keyPath: 'id' });
  }
}

function removeLegacyOutbox(database: IDBPDatabase<CheckpointQueueSchema>): void {
  if (!database.objectStoreNames.contains(LEGACY_PENDING_ACTIVITY_STARTS_STORE_NAME)) {
    return;
  }

  database.deleteObjectStore(LEGACY_PENDING_ACTIVITY_STARTS_STORE_NAME);

  if (database.objectStoreNames.contains(CHECKPOINT_QUEUE_STORE_NAME)) {
    database.deleteObjectStore(CHECKPOINT_QUEUE_STORE_NAME);
  }
}
