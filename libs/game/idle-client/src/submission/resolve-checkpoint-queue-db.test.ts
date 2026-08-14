import { expect, test } from 'bun:test';
import type { DBSchema } from 'idb';
import { deleteDB, openDB } from 'idb';
import {
  CHECKPOINT_QUEUE_STORE_NAME,
  CONTENT_DOCUMENT_STORE_NAME,
  NODE_SEEDS_STORE_NAME,
  PREFERENCES_STORE_NAME,
} from './constants';

/**
 * A database identity distinct from the worker's real `CHECKPOINT_QUEUE_DB_NAME`/
 * `CHECKPOINT_QUEUE_DB_VERSION`: that pair is a module-scoped singleton that some earlier test in
 * this package's shared process may already have opened fresh at the current version, so exercising
 * a real version-3-to-4 upgrade needs its own database this test alone controls.
 */
const UPGRADE_TEST_DB_NAME = 'vers-idle-checkpoint-queue-upgrade-test';

interface UpgradeTestSchema extends DBSchema {
  'content-documents': {
    key: string;
    value: unknown;
  };
  'node-seeds': {
    key: string;
    value: unknown;
  };
  'pending-checkpoints': {
    key: [string, number];
    value: unknown;
  };
  preferences: {
    key: string;
    value: { dirty: boolean };
  };
}

test('it creates the node-seeds store on an upgrade from v3 without dropping the existing stores or their rows', async () => {
  const v3 = await openDB<UpgradeTestSchema>(UPGRADE_TEST_DB_NAME, 3, {
    upgrade(database) {
      database.createObjectStore(CHECKPOINT_QUEUE_STORE_NAME, {
        keyPath: ['activityID', 'version'],
      });

      database.createObjectStore(PREFERENCES_STORE_NAME);
      database.createObjectStore(CONTENT_DOCUMENT_STORE_NAME, { keyPath: 'contentVersion' });
    },
  });

  await v3.put(PREFERENCES_STORE_NAME, { dirty: false }, 'existing-preference');

  v3.close();

  const v4 = await openDB<UpgradeTestSchema>(UPGRADE_TEST_DB_NAME, 4, {
    upgrade(database) {
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
        database.createObjectStore(NODE_SEEDS_STORE_NAME, { keyPath: 'nodeID' });
      }
    },
  });

  const existingPreference = await v4.get(PREFERENCES_STORE_NAME, 'existing-preference');

  expect([...v4.objectStoreNames]).toIncludeAllMembers([
    CHECKPOINT_QUEUE_STORE_NAME,
    PREFERENCES_STORE_NAME,
    CONTENT_DOCUMENT_STORE_NAME,
    NODE_SEEDS_STORE_NAME,
  ]);

  expect(existingPreference).toStrictEqual({ dirty: false });

  v4.close();

  await deleteDB(UPGRADE_TEST_DB_NAME);
});
