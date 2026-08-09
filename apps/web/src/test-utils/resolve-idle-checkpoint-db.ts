import type { IDBPDatabase } from 'idb';
import { openDB } from 'idb';

/**
 * Mirrors the idle worker's private IndexedDB identity (its `resolve-checkpoint-queue-db` in
 * `@vers/idle-client`): the database name and version. The worker exposes no cross-package write
 * path for a continuation-start intent, so a test seeding one opens the same database directly. A
 * drift from the worker's real values fails the seeded-intent read test loudly.
 */
const IDLE_CHECKPOINT_DB_NAME = 'vers-idle-checkpoint-queue';
const IDLE_CHECKPOINT_DB_VERSION = 3;

interface IdleCheckpointDBSchema {
  'content-documents': {
    key: string;
    value: unknown;
  };
  'pending-checkpoints': {
    key: [string, number];
    value: unknown;
  };
  preferences: {
    key: string;
    value: unknown;
  };
}

let idleCheckpointDB: IDBPDatabase<IdleCheckpointDBSchema> | null = null;

/**
 * Opens the idle worker's durable IndexedDB database under its real name, version, and store
 * layout, so a record this seeds lands where the worker's own read of it looks. Store names are
 * checked against the schema at each call, so a mistyped store fails typecheck rather than drifting.
 */
export async function resolveIdleCheckpointDB(): Promise<IDBPDatabase<IdleCheckpointDBSchema>> {
  idleCheckpointDB ??= await openDB<IdleCheckpointDBSchema>(
    IDLE_CHECKPOINT_DB_NAME,
    IDLE_CHECKPOINT_DB_VERSION,
    {
      upgrade(database) {
        if (!database.objectStoreNames.contains('pending-checkpoints')) {
          database.createObjectStore('pending-checkpoints', {
            keyPath: ['activityID', 'version'],
          });
        }

        if (!database.objectStoreNames.contains('preferences')) {
          database.createObjectStore('preferences');
        }

        if (!database.objectStoreNames.contains('content-documents')) {
          database.createObjectStore('content-documents', { keyPath: 'contentVersion' });
        }
      },
    },
  );

  return idleCheckpointDB;
}
