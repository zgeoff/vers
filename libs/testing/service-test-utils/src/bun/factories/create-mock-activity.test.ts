import { expect, test } from 'bun:test';
import { createMockActivity } from './create-mock-activity';

test('it builds a default activity head row', () => {
  const row = createMockActivity();

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
    status: 'active',
  });
});

test('it applies overrides on top of the defaults', () => {
  const row = createMockActivity({ avatarId: 'avatar_1', status: 'stopped' });

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
    status: 'stopped',
  });
});
