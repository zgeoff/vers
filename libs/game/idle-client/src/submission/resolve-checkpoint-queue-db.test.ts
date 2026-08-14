import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import type { IDBPDatabase } from 'idb';
import { deleteDB, openDB } from 'idb';
import {
  CHECKPOINT_QUEUE_STORE_NAME,
  CONTENT_DOCUMENT_STORE_NAME,
  FAILURE_ACTION_PREFERENCE_KEY,
  NODE_SEEDS_STORE_NAME,
  PREFERENCES_STORE_NAME,
} from './constants';
import type { CheckpointQueueSchema } from './types';
import { upgradeCheckpointQueueDB } from './upgrade-checkpoint-queue-db';

/**
 * A database identity distinct from the worker's real `CHECKPOINT_QUEUE_DB_NAME`/
 * `CHECKPOINT_QUEUE_DB_VERSION`: that pair is a module-scoped singleton that some earlier test in
 * this package's shared process may already have opened fresh at the current version, so exercising
 * a real version-3-to-4 upgrade needs its own database this test alone controls.
 */
const UPGRADE_TEST_DB_NAME = 'vers-idle-checkpoint-queue-upgrade-test';

test('it creates the node-seeds store on an upgrade from v3 without dropping the existing stores or their rows', async () => {
  const preference = {
    avatarID: 'avatar-upgrade',
    dirty: false,
    failureAction: ActivityFailureAction.Abort,
  } as const;

  // a prior run that threw before its own cleanup could leave a v4 database behind, which would
  // block this run's open at v3 with a version error — drop any leftover before opening
  await deleteDB(UPGRADE_TEST_DB_NAME);

  let v3: IDBPDatabase<CheckpointQueueSchema> | undefined;
  let v4: IDBPDatabase<CheckpointQueueSchema> | undefined;

  try {
    v3 = await openDB<CheckpointQueueSchema>(UPGRADE_TEST_DB_NAME, 3, {
      upgrade(database) {
        database.createObjectStore(CHECKPOINT_QUEUE_STORE_NAME, {
          keyPath: ['activityID', 'version'],
        });

        database.createObjectStore(PREFERENCES_STORE_NAME);
        database.createObjectStore(CONTENT_DOCUMENT_STORE_NAME, { keyPath: 'contentVersion' });
      },
    });

    await v3.put(PREFERENCES_STORE_NAME, preference, FAILURE_ACTION_PREFERENCE_KEY);

    v3.close();

    v4 = await openDB<CheckpointQueueSchema>(UPGRADE_TEST_DB_NAME, 4, {
      upgrade: upgradeCheckpointQueueDB,
    });

    const existingPreference = await v4.get(PREFERENCES_STORE_NAME, FAILURE_ACTION_PREFERENCE_KEY);

    expect([...v4.objectStoreNames]).toIncludeAllMembers([
      CHECKPOINT_QUEUE_STORE_NAME,
      PREFERENCES_STORE_NAME,
      CONTENT_DOCUMENT_STORE_NAME,
      NODE_SEEDS_STORE_NAME,
    ]);

    expect(existingPreference).toStrictEqual(preference);
  } finally {
    v3?.close();
    v4?.close();

    await deleteDB(UPGRADE_TEST_DB_NAME);
  }
});

test('it upgrades from v4 to v5 without dropping the existing stores or their rows', async () => {
  const upgradeTestV5DBName = 'vers-idle-checkpoint-queue-upgrade-v5-test';

  const preference = {
    avatarID: 'avatar-upgrade-v5',
    dirty: false,
    failureAction: ActivityFailureAction.Abort,
  } as const;

  // a prior run that threw before its own cleanup could leave a v5 database behind, which would
  // block this run's open at v4 with a version error — drop any leftover before opening
  await deleteDB(upgradeTestV5DBName);

  let v4: IDBPDatabase<CheckpointQueueSchema> | undefined;
  let v5: IDBPDatabase<CheckpointQueueSchema> | undefined;

  try {
    v4 = await openDB<CheckpointQueueSchema>(upgradeTestV5DBName, 4, {
      upgrade: upgradeCheckpointQueueDB,
    });

    await v4.put(PREFERENCES_STORE_NAME, preference, FAILURE_ACTION_PREFERENCE_KEY);

    v4.close();

    v5 = await openDB<CheckpointQueueSchema>(upgradeTestV5DBName, 5, {
      upgrade: upgradeCheckpointQueueDB,
    });

    const existingPreference = await v5.get(PREFERENCES_STORE_NAME, FAILURE_ACTION_PREFERENCE_KEY);

    expect([...v5.objectStoreNames]).toIncludeAllMembers([
      CHECKPOINT_QUEUE_STORE_NAME,
      PREFERENCES_STORE_NAME,
      CONTENT_DOCUMENT_STORE_NAME,
      NODE_SEEDS_STORE_NAME,
    ]);

    expect(existingPreference).toStrictEqual(preference);
  } finally {
    v4?.close();
    v5?.close();

    await deleteDB(upgradeTestV5DBName);
  }
});
