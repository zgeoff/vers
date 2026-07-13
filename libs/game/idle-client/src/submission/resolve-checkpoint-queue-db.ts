import type { IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import {
  CHECKPOINT_QUEUE_DB_NAME,
  CHECKPOINT_QUEUE_DB_VERSION,
  CHECKPOINT_QUEUE_STORE_NAME,
} from './constants';
import type { CheckpointQueueSchema } from './types';

let queueDB: null | Promise<IDBPDatabase<CheckpointQueueSchema>> = null;

/**
 * Lazily opens, and caches, the pending-submit queue database: one object store keyed
 * `[activityID, version]`, so an activity's rows sort in submission order and a compound
 * read/delete addresses either a single checkpoint or an activity's whole range.
 */
export function resolveCheckpointQueueDB(): Promise<IDBPDatabase<CheckpointQueueSchema>> {
  queueDB ??= openDB<CheckpointQueueSchema>(CHECKPOINT_QUEUE_DB_NAME, CHECKPOINT_QUEUE_DB_VERSION, {
    upgrade(database) {
      database.createObjectStore(CHECKPOINT_QUEUE_STORE_NAME, {
        keyPath: ['activityID', 'version'],
      });
    },
  });

  return queueDB;
}
