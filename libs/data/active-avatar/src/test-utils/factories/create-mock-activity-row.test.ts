import { expect, test } from 'bun:test';
import { createMockActivityRow } from './create-mock-activity-row';

test('it builds a default activity head row', () => {
  const row = createMockActivityRow();

  expect(row).toStrictEqual({
    avatarId: expect.toBeString(),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    id: expect.toBeString(),
    lastHash: expect.toBeString(),
    scopeId: expect.toBeString(),
    scopeType: 'world_map_node',
    seed: expect.toBeString(),
    simVersion: '0.0.0-dev',
    startHash: expect.toBeString(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const row = createMockActivityRow({ avatarId: 'avatar_1', status: 'active' });

  expect(row).toStrictEqual({
    avatarId: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    id: expect.toBeString(),
    lastHash: expect.toBeString(),
    scopeId: expect.toBeString(),
    scopeType: 'world_map_node',
    seed: expect.toBeString(),
    simVersion: '0.0.0-dev',
    startHash: expect.toBeString(),
    status: 'active',
  });
});
