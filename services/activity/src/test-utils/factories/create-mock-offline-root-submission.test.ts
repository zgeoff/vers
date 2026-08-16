import { expect, test } from 'bun:test';
import { createMockOfflineRootSubmission } from './create-mock-offline-root-submission';

test('it builds a default root submission', () => {
  const root = createMockOfflineRootSubmission();

  expect(root).toStrictEqual({
    avatarID: expect.toBeString(),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '2',
    playedAt: null,
    predecessorActivityID: null,
    scopeID: expect.toBeString(),
    scopeType: 'world_map_node',
    seed: expect.toBeString(),
    simVersion: '0.0.0-dev',
    startChainIndex: 0,
    startHash: expect.toBeString(),
    startKey: expect.toBeString(),
  });
});

test('it defaults startHash to the real start hash of the client-cached inputs', () => {
  const root = createMockOfflineRootSubmission({
    contentVersion: '3',
    keyVersion: 7,
    seed: 'seed_fixed',
    simVersion: 'sim_1',
  });

  expect(root.startHash).toMatch(/^[a-f0-9]{64}$/);
});

test('it applies overrides on top of the faker-generated defaults', () => {
  const root = createMockOfflineRootSubmission({ avatarID: 'avatar_1', scopeID: 'node_1' });

  expect(root).toMatchObject({ avatarID: 'avatar_1', scopeID: 'node_1' });
});
