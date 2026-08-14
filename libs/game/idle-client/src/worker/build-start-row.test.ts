import { expect, test } from 'bun:test';
import { buildStartHash } from '@vers/contract-activity';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { buildLevelFromXP } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { NODE_SEEDS_STORE_NAME } from '../submission/constants';
import { resolveCheckpointQueueDB } from '../submission/resolve-checkpoint-queue-db';
import type { NodeSeed } from '../submission/types';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeStartStamps } from '../submission/write-start-stamps';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { buildStartRow } from './build-start-row';

test('it synthesizes a row whose start hash matches buildStartHash for the same cached inputs', async () => {
  const seed = createMockNodeSeed({ avatarID: 'avatar_1', nodeID: '3_2' });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 4, secretRef: 'worldmap', secretVersion: 2 });

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1' });

  const row = await buildStartRow(context, {
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

test("it roots the mint at a revisited node's cached head rather than its genesis", async () => {
  const seed = createMockNodeSeed({
    avatarID: 'avatar_revisited',
    head: { chainIndex: 6, nextSeed: 'seed-advanced' },
    nodeID: '1_1',
  });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_2' });

  const row = await buildStartRow(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    startKey: 'start_key_2',
  });

  invariant(row !== null, 'expected the cached inputs to synthesize a row');

  expect(row.seed).toBe('seed-advanced');
  expect(row.startChainIndex).toBe(6);
});

test('it returns null when the scope was never cached for the avatar', async () => {
  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1' });

  const row = await buildStartRow(context, {
    avatarID: 'avatar_never_cached',
    scopeID: '0_0',
    scopeType: 'world_map_node',
    startKey: 'start_key_1',
  });

  expect(row).toBeNull();
});

test('it returns null when the cached node row predates the head field', async () => {
  const seed = createMockNodeSeed({ avatarID: 'avatar_legacy_row', nodeID: '1_0' });

  const db = await resolveCheckpointQueueDB();

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- simulates a pre-v6 row that predates the `head` field, which the current `NodeSeed` type can no longer express
  await db.put(NODE_SEEDS_STORE_NAME, {
    avatarID: seed.avatarID,
    contentVersion: seed.contentVersion,
    encounterNode: seed.encounterNode,
    genesisSeed: seed.genesisSeed,
    nodeID: seed.nodeID,
  } as unknown as NodeSeed);

  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1' });

  const row = await buildStartRow(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    startKey: 'start_key_1',
  });

  expect(row).toBeNull();
});

test('it returns null when no start stamps are cached', async () => {
  const seed = createMockNodeSeed({ avatarID: 'avatar_no_stamps', nodeID: '1_0' });

  await writeNodeSeeds(seed.avatarID, [seed]);

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1' });

  const row = await buildStartRow(context, {
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

  const context = createStubWorkerContext();

  const row = await buildStartRow(context, {
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

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1' });

  context.setActivity(
    createMockActivityData({ avatarID: seed.avatarID, buildSnapshot: { level: 7, xp: 8450 } }),
  );

  const row = await buildStartRow(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    startKey: 'start_key_1',
  });

  invariant(row !== null, 'expected the cached inputs to synthesize a row');

  // the level is recomputed from the carried-forward xp rather than trusted from the source row
  expect(row.buildSnapshot).toStrictEqual({ level: buildLevelFromXP(8450), xp: 8450 });
});

test("it starts a fresh avatar's build snapshot at zero xp when the worker holds no prior activity row for it", async () => {
  const seed = createMockNodeSeed({ avatarID: 'avatar_fresh', nodeID: '1_0' });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1' });

  context.setActivity(createMockActivityData({ avatarID: 'a-different-avatar' }));

  const row = await buildStartRow(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    startKey: 'start_key_1',
  });

  invariant(row !== null, 'expected the cached inputs to synthesize a row');

  expect(row.buildSnapshot).toStrictEqual({ level: 1, xp: 0 });
});
