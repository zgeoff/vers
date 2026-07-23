import type { IDBPDatabase } from 'idb';
import { openDB } from 'idb';

/**
 * Preferences-store record shapes the idle worker's IndexedDB database holds; only the
 * continuation-start intent shape is written here, mirroring `PendingStartIntent`.
 */
interface IdleCheckpointDBSchema {
  'pending-checkpoints': {
    key: [string, number];
    value: unknown;
  };
  preferences: {
    key: string;
    value: unknown;
  };
}

const IDLE_CHECKPOINT_DB_NAME = 'vers-idle-checkpoint-queue';
const IDLE_CHECKPOINT_DB_VERSION = 2;
const IDLE_CHECKPOINT_CHECKPOINTS_STORE_NAME = 'pending-checkpoints';

/**
 * The `preferences` object store name, exported so a seed and its later read agree on where a
 * record lives.
 */
export const IDLE_CHECKPOINT_PREFERENCES_STORE_NAME = 'preferences';
let idleCheckpointDB: IDBPDatabase<IdleCheckpointDBSchema> | null = null;

/**
 * Opens the idle worker's durable IndexedDB database under its real name, version, and store
 * layout, so a record this seeds lands where the worker's own read of it looks. The worker package
 * exposes no cross-package write path for a continuation-start intent — reading is the only
 * exported access — so a test seeding one writes directly against this mirrored schema instead.
 */
export async function resolveIdleCheckpointDB(): Promise<IDBPDatabase<IdleCheckpointDBSchema>> {
  idleCheckpointDB ??= await openDB<IdleCheckpointDBSchema>(
    IDLE_CHECKPOINT_DB_NAME,
    IDLE_CHECKPOINT_DB_VERSION,
    {
      upgrade(database) {
        if (!database.objectStoreNames.contains(IDLE_CHECKPOINT_CHECKPOINTS_STORE_NAME)) {
          database.createObjectStore(IDLE_CHECKPOINT_CHECKPOINTS_STORE_NAME, {
            keyPath: ['activityID', 'version'],
          });
        }

        if (!database.objectStoreNames.contains(IDLE_CHECKPOINT_PREFERENCES_STORE_NAME)) {
          database.createObjectStore(IDLE_CHECKPOINT_PREFERENCES_STORE_NAME);
        }
      },
    },
  );

  return idleCheckpointDB;
}
