import type { IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import {
  CHECKPOINT_QUEUE_DB_NAME,
  CHECKPOINT_QUEUE_DB_VERSION,
  CHECKPOINT_QUEUE_STORE_NAME,
  PREFERENCES_STORE_NAME,
} from './constants';
import type { CheckpointQueueSchema } from './types';

let queueDB: null | Promise<IDBPDatabase<CheckpointQueueSchema>> = null;

/**
 * Lazily opens, and caches, the worker's durable IndexedDB database: `pending-checkpoints` keyed
 * `[activityID, version]`, so an activity's rows sort in submission order and a compound
 * read/delete addresses either a single checkpoint or an activity's whole range; `preferences`
 * caches device-local settings — a SharedWorker has no `localStorage` — as the offline outbox for
 * a server source of truth. Each store is created only if missing, so an upgrade from an earlier
 * version never re-creates a store an existing install already has.
 */
export function resolveCheckpointQueueDB(): Promise<IDBPDatabase<CheckpointQueueSchema>> {
  queueDB ??= openDB<CheckpointQueueSchema>(CHECKPOINT_QUEUE_DB_NAME, CHECKPOINT_QUEUE_DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(CHECKPOINT_QUEUE_STORE_NAME)) {
        database.createObjectStore(CHECKPOINT_QUEUE_STORE_NAME, {
          keyPath: ['activityID', 'version'],
        });
      }

      if (!database.objectStoreNames.contains(PREFERENCES_STORE_NAME)) {
        database.createObjectStore(PREFERENCES_STORE_NAME);
      }
    },
  });

  return queueDB;
}
