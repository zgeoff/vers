import type { IDBPDatabase } from 'idb';
import { openDB } from 'idb';

const IDLE_CHECKPOINT_DB_NAME = 'vers-idle-checkpoint-queue';
const IDLE_CHECKPOINT_DB_VERSION = 7;

interface IdleCheckpointDBSchema {
  'content-documents': {
    key: string;
    value: unknown;
  };
  'node-seeds': {
    key: [string, string];
    value: unknown;
  };
  'pending-checkpoints': {
    key: [string, number];
    value: unknown;
  };
  'pending-activity-starts': {
    key: string;
    value: unknown;
  };

  'pending-roots': {
    key: string;
    value: unknown;
  };
  preferences: {
    key: string;
    value: unknown;
  };
}

let idleCheckpointDB: IDBPDatabase<IdleCheckpointDBSchema> | null = null;

export async function resolveIdleCheckpointDB(): Promise<IDBPDatabase<IdleCheckpointDBSchema>> {
  idleCheckpointDB ??= await openDB<IdleCheckpointDBSchema>(
    IDLE_CHECKPOINT_DB_NAME,
    IDLE_CHECKPOINT_DB_VERSION,
    {
      upgrade(database) {
        // mirrors the worker's own version-7 upgrade: a database still holding the outbox under
        // its legacy store name has the whole outbox dropped rather than migrated
        if (database.objectStoreNames.contains('pending-roots')) {
          database.deleteObjectStore('pending-roots');

          if (database.objectStoreNames.contains('pending-checkpoints')) {
            database.deleteObjectStore('pending-checkpoints');
          }
        }

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

        if (!database.objectStoreNames.contains('node-seeds')) {
          database.createObjectStore('node-seeds', { keyPath: ['avatarID', 'nodeID'] });
        }

        if (!database.objectStoreNames.contains('pending-activity-starts')) {
          database.createObjectStore('pending-activity-starts', { keyPath: 'id' });
        }
      },
    },
  );

  return idleCheckpointDB;
}
