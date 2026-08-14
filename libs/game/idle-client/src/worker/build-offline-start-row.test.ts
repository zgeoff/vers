import { expect, test } from 'bun:test';
import { buildStartHash } from '@vers/contract-activity';
import {
  createMockActivityData,
  createMockContentDocument,
} from '@vers/contract-activity/test-utils';
import invariant from 'tiny-invariant';
import { writeContentDocumentCache } from '../content/write-content-document-cache';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeStartStamps } from '../submission/write-start-stamps';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { buildOfflineStartRow } from './build-offline-start-row';

test('it synthesizes a row whose start hash matches buildStartHash for the same cached inputs', async () => {
  const seed = createMockNodeSeed({ avatarID: 'avatar_1', nodeID: '3_2' });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 4, secretRef: 'worldmap', secretVersion: 2 });

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: seed.contentVersion }),
  );

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1' });

  const row = await buildOfflineStartRow(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    startKey: 'start_key_1',
  });

  invariant(row !== null, 'expected the cached inputs to synthesize a row');

  const expectedHash = buildStartHash({
    contentVersion: seed.contentVersion,
    encounterNode: seed.encounterNode,
    keyVersion: 4,
    seed: seed.genesisSeed,
    simVersion: 'engine_hash_1',
  });

  expect(row).toStrictEqual({
    appendedAt: null,
    appendedHead: 0,
    avatarID: seed.avatarID,
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: seed.contentVersion,
    createdAt: expect.toBeValidDate(),
    encounterNode: seed.encounterNode,
    id: expect.toStartWith('act_'),
    keyVersion: 4,
    lastHash: expectedHash,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    secretRef: 'worldmap',
    secretVersion: 2,
    seed: seed.genesisSeed,
    simVersion: 'engine_hash_1',
    startChainIndex: 0,
    startHash: expectedHash,
    startKey: 'start_key_1',
    startedAt: expect.toBeValidDate(),
    status: 'active',
    stoppedAt: null,
    updatedAt: expect.toBeValidDate(),
    verifiedAt: null,
    verifiedHead: 0,
  });
});

test('it returns null when the scope was never cached for the avatar', async () => {
  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1' });

  const row = await buildOfflineStartRow(context, {
    avatarID: 'avatar_never_cached',
    scopeID: '0_0',
    scopeType: 'world_map_node',
    startKey: 'start_key_1',
  });

  expect(row).toBeNull();
});

test('it returns null when no start stamps are cached', async () => {
  const seed = createMockNodeSeed({ avatarID: 'avatar_no_stamps', nodeID: '1_0' });

  await writeNodeSeeds(seed.avatarID, [seed]);

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: seed.contentVersion }),
  );

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1' });

  const row = await buildOfflineStartRow(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    startKey: 'start_key_1',
  });

  expect(row).toBeNull();
});

test('it returns null when the build carries no bundled engine hash', async () => {
  const seed = createMockNodeSeed({ avatarID: 'avatar_no_hash', nodeID: '1_0' });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: seed.contentVersion }),
  );

  const context = createStubWorkerContext();

  const row = await buildOfflineStartRow(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    startKey: 'start_key_1',
  });

  expect(row).toBeNull();
});

test('it returns null when the content document is not cached', async () => {
  const seed = createMockNodeSeed({ avatarID: 'avatar_no_content_doc', nodeID: '1_0' });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1' });

  const row = await buildOfflineStartRow(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    startKey: 'start_key_1',
  });

  expect(row).toBeNull();
});

test('it sources the build snapshot from the last activity this worker installed for the avatar', async () => {
  const seed = createMockNodeSeed({ avatarID: 'avatar_with_history', nodeID: '1_0' });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: seed.contentVersion }),
  );

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1' });

  context.setActivity(
    createMockActivityData({ avatarID: seed.avatarID, buildSnapshot: { level: 7, xp: 8450 } }),
  );

  const row = await buildOfflineStartRow(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    startKey: 'start_key_1',
  });

  invariant(row !== null, 'expected the cached inputs to synthesize a row');

  expect(row.buildSnapshot).toStrictEqual({ level: 7, xp: 8450 });
});

test("it starts a fresh avatar's build snapshot at zero xp when the worker holds no prior activity row for it", async () => {
  const seed = createMockNodeSeed({ avatarID: 'avatar_fresh', nodeID: '1_0' });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: seed.contentVersion }),
  );

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1' });

  context.setActivity(createMockActivityData({ avatarID: 'a-different-avatar' }));

  const row = await buildOfflineStartRow(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    startKey: 'start_key_1',
  });

  invariant(row !== null, 'expected the cached inputs to synthesize a row');

  expect(row.buildSnapshot).toStrictEqual({ level: 1, xp: 0 });
});
