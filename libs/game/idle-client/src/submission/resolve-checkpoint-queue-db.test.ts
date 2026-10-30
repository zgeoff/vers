import { expect, onTestFinished, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityFailureAction } from '@vers/idle-core';
import { deleteDB, openDB, unwrap } from 'idb';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import {
  CHECKPOINT_QUEUE_DB_NAME,
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

test('it creates the node-seeds store on an upgrade from v3 without dropping the existing stores or their rows', async () => {
  // a database of its own: the real name/version pair is a module-scoped singleton an earlier
  // test in this shared process may already have opened fresh at the current version, so a real
  // upgrade cannot run on it
  const upgradeDBName = 'vers-idle-checkpoint-queue-upgrade-test';

  const preference = {
    avatarID: 'avatar-upgrade',
    dirty: false,
    failureAction: ActivityFailureAction.Abort,
  } as const;

  // a run that stopped before its cleanup could leave a v4 database behind, which would block this
  // run's open at v3 with a version error — drop any leftover before opening
  await deleteDB(upgradeDBName);

  const v3 = await openDB<CheckpointQueueSchema>(upgradeDBName, 3, {
    upgrade(database) {
      database.createObjectStore(CHECKPOINT_QUEUE_STORE_NAME, {
        keyPath: ['activityID', 'version'],
      });

      database.createObjectStore(PREFERENCES_STORE_NAME);
      database.createObjectStore(CONTENT_DOCUMENT_STORE_NAME, { keyPath: 'contentVersion' });
    },
  });

  onTestFinished(() => {
    v3.close();
  });

  await v3.put(PREFERENCES_STORE_NAME, preference, FAILURE_ACTION_PREFERENCE_KEY);

  v3.close();

  const v4 = await openDB<CheckpointQueueSchema>(upgradeDBName, 4, {
    upgrade: upgradeCheckpointQueueDB,
  });

  // a delete waits on every open connection, so the connection closes first
  onTestFinished(async () => {
    v4.close();

    await deleteDB(upgradeDBName);
  });

  const existingPreference = await v4.get(PREFERENCES_STORE_NAME, FAILURE_ACTION_PREFERENCE_KEY);

  expect([...v4.objectStoreNames]).toIncludeAllMembers([
    CHECKPOINT_QUEUE_STORE_NAME,
    PREFERENCES_STORE_NAME,
    CONTENT_DOCUMENT_STORE_NAME,
    NODE_SEEDS_STORE_NAME,
  ]);

  expect(existingPreference).toStrictEqual(preference);
});

test('it reads a node-seeds cache row that fails its schema as a miss and deletes the row', async () => {
  // node-seeds is a cache: a row that no longer matches its contract schema self-heals on read
  // against the real queue database, independent of any version upgrade running at all.
  const cacheDB = await resolveCheckpointQueueDB();

  const transaction = cacheDB.transaction(NODE_SEEDS_STORE_NAME, 'readwrite');

  // a row missing `anchor`, which the store's typed put refuses
  unwrap(transaction.store).put({
    avatarID: 'avatar-self-heal',
    contentVersion: '1',
    encounterNode: { difficulty: 1 },
    genesisSeed: 'seed-self-heal',
    nodeID: '1_0',
  });

  await transaction.done;

  const readAfterMalformedPut = await readNodeSeed('avatar-self-heal', '1_0');

  expect(readAfterMalformedPut).toBeUndefined();

  const stillStored = await cacheDB.get(NODE_SEEDS_STORE_NAME, ['avatar-self-heal', '1_0']);

  expect(stillStored).toBeUndefined();
});

test('it keeps the pending-checkpoints rows when an upgrade adds the pending-activity-starts outbox store', async () => {
  // pending-checkpoints and pending-activity-starts are the outbox: adding the outbox store a
  // database predates must preserve the queued checkpoints already there, since a miss would
  // silently discard un-synced local progress.
  const upgradeTestDBName = 'vers-idle-checkpoint-queue-outbox-upgrade-test';

  const queuedCheckpoint = {
    ...createMockCheckpointBatchEntry({ version: 1 }),
    activityID: 'activity-outbox-upgrade',
  };

  // a run that stopped before its cleanup could leave a database behind, which would block this
  // run's open at the older version with a version error — drop any leftover first
  await deleteDB(upgradeTestDBName);

  // an older database predating pending-activity-starts: every cache and outbox store except it
  const vOld = await openDB<CheckpointQueueSchema>(upgradeTestDBName, 5, {
    upgrade(database) {
      database.createObjectStore(CHECKPOINT_QUEUE_STORE_NAME, {
        keyPath: ['activityID', 'version'],
      });

      database.createObjectStore(PREFERENCES_STORE_NAME);
      database.createObjectStore(CONTENT_DOCUMENT_STORE_NAME, { keyPath: 'contentVersion' });
      database.createObjectStore(NODE_SEEDS_STORE_NAME, { keyPath: ['avatarID', 'nodeID'] });
    },
  });

  onTestFinished(() => {
    vOld.close();
  });

  await vOld.put(CHECKPOINT_QUEUE_STORE_NAME, queuedCheckpoint);

  vOld.close();

  const vNew = await openDB<CheckpointQueueSchema>(upgradeTestDBName, CHECKPOINT_QUEUE_DB_VERSION, {
    upgrade: upgradeCheckpointQueueDB,
  });

  onTestFinished(async () => {
    vNew.close();

    await deleteDB(upgradeTestDBName);
  });

  const existingCheckpoint = await vNew.get(CHECKPOINT_QUEUE_STORE_NAME, [
    queuedCheckpoint.activityID,
    queuedCheckpoint.version,
  ]);

  expect([...vNew.objectStoreNames]).toContain(PENDING_ACTIVITY_STARTS_STORE_NAME);
  expect(existingCheckpoint).toStrictEqual(queuedCheckpoint);
});

test('it drops both outbox stores on an upgrade of a database that holds the legacy outbox store', async () => {
  // the legacy store and pending-checkpoints are one outbox, and a queued checkpoint whose
  // activity start is gone can only be refused on delivery, so the upgrade discards the pair
  // rather than leaving the checkpoints behind
  const legacyTestDBName = 'vers-idle-checkpoint-queue-legacy-outbox-test';

  const queuedCheckpoint = {
    ...createMockCheckpointBatchEntry({ version: 1 }),
    activityID: 'activity-legacy-outbox',
  };

  await deleteDB(legacyTestDBName);

  const vOld = await openDB<CheckpointQueueSchema>(legacyTestDBName, 6, {
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

  onTestFinished(() => {
    vOld.close();
  });

  await vOld.put(CHECKPOINT_QUEUE_STORE_NAME, queuedCheckpoint);
  await vOld.put(LEGACY_PENDING_ACTIVITY_STARTS_STORE_NAME, createMockActivityData());

  vOld.close();

  const vNew = await openDB<CheckpointQueueSchema>(legacyTestDBName, CHECKPOINT_QUEUE_DB_VERSION, {
    upgrade: upgradeCheckpointQueueDB,
  });

  onTestFinished(async () => {
    vNew.close();

    await deleteDB(legacyTestDBName);
  });

  const storeNames = [...vNew.objectStoreNames];

  const activityStartCount = await vNew.count(PENDING_ACTIVITY_STARTS_STORE_NAME);
  const queuedCheckpointCount = await vNew.count(CHECKPOINT_QUEUE_STORE_NAME);

  expect(storeNames).not.toContain(LEGACY_PENDING_ACTIVITY_STARTS_STORE_NAME);
  expect(storeNames).toContain(PENDING_ACTIVITY_STARTS_STORE_NAME);
  expect(activityStartCount).toBe(0);
  expect(queuedCheckpointCount).toBe(0);
});

test("it closes its connection for another context's upgrade and opens afresh afterwards", async () => {
  const before = await resolveCheckpointQueueDB();

  // a newer build opening the journal at a higher version: the held connection must yield, or the
  // upgrade waits on it forever
  const upgraded = await openDB<CheckpointQueueSchema>(
    CHECKPOINT_QUEUE_DB_NAME,
    CHECKPOINT_QUEUE_DB_VERSION + 1,
    { upgrade() {} },
  );

  upgraded.close();

  onTestFinished(async () => {
    await deleteDB(CHECKPOINT_QUEUE_DB_NAME);
  });

  await deleteDB(CHECKPOINT_QUEUE_DB_NAME);

  const after = await resolveCheckpointQueueDB();
  const rows = await after.count(CHECKPOINT_QUEUE_STORE_NAME);

  expect(after).not.toBe(before);
  expect(rows).toBe(0);
});

test('it retries the open after a failed first open', async () => {
  await resolveCheckpointQueueDB();

  // the higher open makes the held connection yield and forget itself, and leaves the journal at
  // a version the bundled open then refuses
  const higher = await openDB<CheckpointQueueSchema>(
    CHECKPOINT_QUEUE_DB_NAME,
    CHECKPOINT_QUEUE_DB_VERSION + 1,
    { upgrade() {} },
  );

  higher.close();

  onTestFinished(async () => {
    await deleteDB(CHECKPOINT_QUEUE_DB_NAME);
  });

  await expect(resolveCheckpointQueueDB()).toReject();

  await deleteDB(CHECKPOINT_QUEUE_DB_NAME);

  const recovered = await resolveCheckpointQueueDB();
  const rows = await recovered.count(CHECKPOINT_QUEUE_STORE_NAME);

  expect(rows).toBe(0);
});
