import type { IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import { CHECKPOINT_QUEUE_DB_NAME, CHECKPOINT_QUEUE_DB_VERSION } from './constants';
import type { CheckpointQueueSchema } from './types';
import { upgradeCheckpointQueueDB } from './upgrade-checkpoint-queue-db';

let queueDB: null | Promise<IDBPDatabase<CheckpointQueueSchema>> = null;

/**
 * Lazily opens, and caches, the worker's durable IndexedDB database, creating its stores through
 * the shared upgrade callback so the open path and an upgrade-driving test exercise the same store
 * layout.
 */
export function resolveCheckpointQueueDB(): Promise<IDBPDatabase<CheckpointQueueSchema>> {
  queueDB ??= openDB<CheckpointQueueSchema>(CHECKPOINT_QUEUE_DB_NAME, CHECKPOINT_QUEUE_DB_VERSION, {
    upgrade: upgradeCheckpointQueueDB,
  });

  return queueDB;
}
