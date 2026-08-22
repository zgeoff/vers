import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityFailureAction } from '@vers/idle-core';
import type { IDBPDatabase } from 'idb';
import { deleteDB, openDB } from 'idb';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import {
  CHECKPOINT_QUEUE_DB_VERSION,
  CHECKPOINT_QUEUE_STORE_NAME,
  CONTENT_DOCUMENT_STORE_NAME,
  FAILURE_ACTION_PREFERENCE_KEY,
  LEGACY_PENDING_ACTIVITY_STARTS_STORE_NAME,
  NODE_SEEDS_STORE_NAME,
  PENDING_ACTIVITY_STARTS_STORE_NAME,
  PREFERENCES_STORE_NAME,
} from './constants';
import { readNodeSeed } from './read-node-seed';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
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

test('a node-seeds cache row failing its schema reads as a miss and is deleted', async () => {
  // node-seeds is a cache: a row that no longer matches its contract schema self-heals on read
  // against the real queue database, independent of any version upgrade running at all.
  const cacheDB = await resolveCheckpointQueueDB();

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a deliberately malformed row (missing `anchor`) exercising the self-healing parse failure path
  await cacheDB.put(NODE_SEEDS_STORE_NAME, {
    avatarID: 'avatar-self-heal',
    contentVersion: '1',
    encounterNode: { difficulty: 1 },
    genesisSeed: 'seed-self-heal',
    nodeID: '1_0',
  } as never);

  const readAfterMalformedPut = await readNodeSeed('avatar-self-heal', '1_0');

  expect(readAfterMalformedPut).toBeUndefined();

  const stillStored = await cacheDB.get(NODE_SEEDS_STORE_NAME, ['avatar-self-heal', '1_0']);

  expect(stillStored).toBeUndefined();
});

test('adding the pending-activity-starts outbox store on an upgrade preserves the pending-checkpoints rows', async () => {
  // pending-checkpoints and pending-activity-starts are the outbox: adding the outbox store a
  // database predates must preserve the queued checkpoints already there, since a miss would
  // silently discard un-synced local progress.
  const upgradeTestDBName = 'vers-idle-checkpoint-queue-outbox-upgrade-test';

  const queuedCheckpoint = {
    ...createMockCheckpointBatchEntry({ version: 1 }),
    activityID: 'activity-outbox-upgrade',
  };

  // a prior run that threw before its own cleanup could leave a database behind, which would
  // block this run's open at the older version with a version error — drop any leftover first
  await deleteDB(upgradeTestDBName);

  let vOld: IDBPDatabase<CheckpointQueueSchema> | undefined;
  let vNew: IDBPDatabase<CheckpointQueueSchema> | undefined;

  try {
    // an older database predating pending-activity-starts: every cache and outbox store except it
    vOld = await openDB<CheckpointQueueSchema>(upgradeTestDBName, 5, {
      upgrade(database) {
        database.createObjectStore(CHECKPOINT_QUEUE_STORE_NAME, {
          keyPath: ['activityID', 'version'],
        });

        database.createObjectStore(PREFERENCES_STORE_NAME);
        database.createObjectStore(CONTENT_DOCUMENT_STORE_NAME, { keyPath: 'contentVersion' });
        database.createObjectStore(NODE_SEEDS_STORE_NAME, { keyPath: ['avatarID', 'nodeID'] });
      },
    });

    await vOld.put(CHECKPOINT_QUEUE_STORE_NAME, queuedCheckpoint);

    vOld.close();

    vNew = await openDB<CheckpointQueueSchema>(upgradeTestDBName, CHECKPOINT_QUEUE_DB_VERSION, {
      upgrade: upgradeCheckpointQueueDB,
    });

    const existingCheckpoint = await vNew.get(CHECKPOINT_QUEUE_STORE_NAME, [
      queuedCheckpoint.activityID,
      queuedCheckpoint.version,
    ]);

    expect([...vNew.objectStoreNames]).toContain(PENDING_ACTIVITY_STARTS_STORE_NAME);
    expect(existingCheckpoint).toStrictEqual(queuedCheckpoint);
  } finally {
    vOld?.close();
    vNew?.close();

    await deleteDB(upgradeTestDBName);
  }
});

test('upgrading a database holding the legacy outbox store drops both outbox stores', async () => {
  // the legacy store and pending-checkpoints are one outbox, and a queued checkpoint whose
  // activity start is gone can only be refused on delivery, so the upgrade discards the pair
  // rather than leaving the checkpoints behind
  const legacyTestDBName = 'vers-idle-checkpoint-queue-legacy-outbox-test';

  const queuedCheckpoint = {
    ...createMockCheckpointBatchEntry({ version: 1 }),
    activityID: 'activity-legacy-outbox',
  };

  await deleteDB(legacyTestDBName);

  let vOld: IDBPDatabase<CheckpointQueueSchema> | undefined;
  let vNew: IDBPDatabase<CheckpointQueueSchema> | undefined;

  try {
    vOld = await openDB<CheckpointQueueSchema>(legacyTestDBName, 6, {
      upgrade(database) {
        database.createObjectStore(CHECKPOINT_QUEUE_STORE_NAME, {
          keyPath: ['activityID', 'version'],
        });

        database.createObjectStore(PREFERENCES_STORE_NAME);
        database.createObjectStore(CONTENT_DOCUMENT_STORE_NAME, { keyPath: 'contentVersion' });
        database.createObjectStore(NODE_SEEDS_STORE_NAME, { keyPath: ['avatarID', 'nodeID'] });
        database.createObjectStore(LEGACY_PENDING_ACTIVITY_STARTS_STORE_NAME, { keyPath: 'id' });
      },
    });

    await vOld.put(CHECKPOINT_QUEUE_STORE_NAME, queuedCheckpoint);
    await vOld.put(LEGACY_PENDING_ACTIVITY_STARTS_STORE_NAME, createMockActivityData());

    vOld.close();

    vNew = await openDB<CheckpointQueueSchema>(legacyTestDBName, CHECKPOINT_QUEUE_DB_VERSION, {
      upgrade: upgradeCheckpointQueueDB,
    });

    const storeNames = [...vNew.objectStoreNames];

    expect(storeNames).not.toContain(LEGACY_PENDING_ACTIVITY_STARTS_STORE_NAME);
    expect(storeNames).toContain(PENDING_ACTIVITY_STARTS_STORE_NAME);

    const activityStartCount = await vNew.count(PENDING_ACTIVITY_STARTS_STORE_NAME);
    const queuedCheckpointCount = await vNew.count(CHECKPOINT_QUEUE_STORE_NAME);

    expect(activityStartCount).toBe(0);
    expect(queuedCheckpointCount).toBe(0);
  } finally {
    vOld?.close();
    vNew?.close();

    await deleteDB(legacyTestDBName);
  }
});
