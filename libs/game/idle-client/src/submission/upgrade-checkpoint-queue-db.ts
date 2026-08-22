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

/**
 * Creates every object store the worker's durable cache needs on a fresh open or a version
 * upgrade. Each store is created only if missing, so an upgrade from an earlier version adds the
 * stores that version lacks without dropping the ones it already holds or their rows.
 *
 * The stores split by durability. `content-documents` and `node-seeds` are caches: a row that no
 * longer matches its current contract schema self-heals on read — its read boundary deletes the row
 * and reads it as a miss, and the next fetch or reveal repopulates it — so neither store carries a
 * version-specific migration here. `pending-checkpoints` and `pending-activity-starts` are the
 * outbox: un-synced local progress a device has not yet delivered to the server, which a
 * cache-style miss would silently drop, so a shape change to either needs a real versioned
 * migration in this function instead. Cache self-healing catches shape drift only: a row whose
 * meaning changed while its shape still satisfies its schema reads as a hit, so a semantic change
 * to a cached value needs an explicit version bump too.
 *
 * A database still holding the outbox under its legacy store name is upgraded by discarding it:
 * the whole outbox is dropped and recreated empty, so the device delivers nothing it held from
 * before the rename.
 */
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

/**
 * Drops both outbox stores when the database still carries activity starts under the legacy store
 * name, discarding whatever un-synced progress they held. The pair is one outbox — a queued
 * checkpoint outlives its activity start only to be refused on delivery — so the two are dropped
 * together rather than left in a half state.
 */
function removeLegacyOutbox(database: IDBPDatabase<CheckpointQueueSchema>): void {
  if (!database.objectStoreNames.contains(LEGACY_PENDING_ACTIVITY_STARTS_STORE_NAME)) {
    return;
  }

  database.deleteObjectStore(LEGACY_PENDING_ACTIVITY_STARTS_STORE_NAME);

  if (database.objectStoreNames.contains(CHECKPOINT_QUEUE_STORE_NAME)) {
    database.deleteObjectStore(CHECKPOINT_QUEUE_STORE_NAME);
  }
}
