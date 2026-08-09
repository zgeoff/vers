import { expect, test } from 'bun:test';
import { createMockActivity } from './create-mock-activity';

test('it builds a default activity row', () => {
  const row = createMockActivity();

  expect(row).toStrictEqual({
    avatarId: expect.toBeString(),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: expect.toBeNumber() },
    id: expect.toBeString(),
    keyVersion: 1,
    lastHash: expect.toBeString(),
    scopeId: expect.toBeString(),
    scopeType: 'world_map_node',
    secretRef: 'worldmap',
    secretVersion: 1,
    seed: expect.toBeString(),
    simVersion: '0.0.0-dev',
    startHash: expect.toBeString(),
  });
});

test('it defaults lastHash and startHash to the real start hash of its own fields', () => {
  const row = createMockActivity({
    contentVersion: 'content_1',
    id: 'act_fixed',
    keyVersion: 7,
    seed: 'seed_fixed',
    simVersion: 'sim_1',
  });

  expect(row.startHash).toBe(row.lastHash);
  expect(row.startHash).toMatch(/^[a-f0-9]{64}$/);
});

test('it applies overrides on top of the faker-generated defaults', () => {
  const row = createMockActivity({ avatarId: 'avatar_1', scopeId: 'node_1', status: 'stopped' });

  expect(row).toMatchObject({ avatarId: 'avatar_1', scopeId: 'node_1', status: 'stopped' });
});
