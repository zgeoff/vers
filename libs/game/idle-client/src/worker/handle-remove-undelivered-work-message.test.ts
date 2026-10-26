import { expect, test } from 'bun:test';
import {
  createMockActivityData,
  createMockContentDocument,
} from '@vers/contract-activity/test-utils';
import { buildLevelFromXP, createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { createViewer } from '@vers/mock-services';
import * as db from '@vers/mock-services/db';
import { writeContentDocumentCache } from '../content/write-content-document-cache';
import { server } from '../mocks/node';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readAllQueuedCheckpoints } from '../submission/read-all-queued-checkpoints';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeMintedActivityStart } from '../submission/write-minted-activity-start';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { writeStartStamps } from '../submission/write-start-stamps';
import { buildStubHeldWriter } from '../test-utils/build-stub-held-writer';
import { createStubActivityProxy } from '../test-utils/create-stub-activity-proxy';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { buildDeferred } from './build-deferred';
import { handleRemoveUndeliveredWorkMessage } from './handle-remove-undelivered-work-message';
import { handleReportOnlineMessage } from './handle-report-online-message';

test('it clears the pending starts and the queued checkpoints, and detaches the live activity', async () => {
  const start = createMockActivityData({ avatarID: 'avatar-owned' });

  await writeActivityStart(start);
  await writeQueuedCheckpoint(start.id, createMockCheckpointBatchEntry());

  const context = createStubWorkerContext();

  context.setActivity(start);
  context.setSimulation(createSimulation());

  await handleRemoveUndeliveredWorkMessage(context, { avatarIDs: ['avatar-owned'] });

  const remainingStarts = await readAllActivityStarts();
  const remainingCheckpoints = await readAllQueuedCheckpoints();

  expect(remainingStarts).toStrictEqual([]);
  expect(remainingCheckpoints).toStrictEqual([]);
  expect(context.getActivity()).toBeNull();
});

test("it keeps another avatar's pending start and its queued checkpoints", async () => {
  const foreign = createMockActivityData({ avatarID: 'avatar-foreign' });
  const entry = createMockCheckpointBatchEntry();

  await writeActivityStart(foreign);
  await writeQueuedCheckpoint(foreign.id, entry);

  const context = createStubWorkerContext();

  await handleRemoveUndeliveredWorkMessage(context, { avatarIDs: ['avatar-owned'] });

  const remainingStarts = await readAllActivityStarts();
  const remainingCheckpoints = await readAllQueuedCheckpoints();

  expect(remainingStarts).toStrictEqual([foreign]);
  expect(remainingCheckpoints).toStrictEqual([{ ...entry, activityID: foreign.id }]);
});

test('it delivers no start that a continuation held at its write mints, once the sign-out discard ran and the player signs back in', async () => {
  const viewer = await createViewer({ avatar: { xp: 400 } });

  server.use(createStubActivityProxy(viewer.user.id));

  const held = buildStubHeldWriter(writeMintedActivityStart);

  const context = createStubWorkerContext({
    activityProxy: true,
    bundledEngineHash: 'engine_hash_sign_out',
    submitter: createStubSubmitter(),
    writeMintedActivityStart: held.write,
  });

  const seed = createMockNodeSeed({
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 1 },
    nodeID: '0_0',
  });

  await writeNodeSeeds(viewer.avatar.id, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: seed.contentVersion }),
  );

  const delivered = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(400), xp: 400 },
    scopeID: '0_0',
    status: 'stopped',
    verifiedHead: 0,
  });

  await db.checkpointCollection.create({
    activityID: delivered.id,
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      rewards: { xp: 9 },
      seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      time: 1000,
      type: 'failed',
    },
    version: 1,
  });

  await handleReportOnlineMessage(context, { avatarID: viewer.avatar.id, claim: true });

  // the run that just reached its terminal checkpoint, so the worker enters the continuation flow
  const terminal = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: delivered.id,
    scopeID: '0_0',
  });

  const simulation = createSimulation();

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: terminal.id }));
  context.setSimulation(simulation);
  context.setActivity(terminal);

  context.getLifecycle().send({
    activity: terminal,
    deferred: buildDeferred<void>(),
    simulation,
    type: 'CONTINUATION',
  });

  await held.reached;

  const discarded = handleRemoveUndeliveredWorkMessage(context, { avatarIDs: [viewer.avatar.id] });

  held.release();

  await discarded;
  await handleReportOnlineMessage(context, { avatarID: viewer.avatar.id, claim: true });

  const serverRows = db.activityCollection.findMany((query) =>
    query.where({ avatarID: viewer.avatar.id }),
  );

  expect(serverRows.map((row) => row.id)).toStrictEqual([delivered.id]);
});
