import { expect, test } from 'bun:test';
import { createMockActivityRow } from './create-mock-activity-row';

test('it builds a default activity row', () => {
  const row = createMockActivityRow();

  expect(row).toStrictEqual({
    avatarId: expect.toBeString(),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    id: expect.toStartWith('act_'),
    lastHash: row.startHash,
    scopeId: expect.toBeString(),
    scopeType: 'world_map_node',
    secretRef: 'worldmap',
    secretVersion: 1,
    seed: expect.toBeString(),
    simVersion: '0.0.0-dev',
    startHash: expect.toBeString(),
  });

  expect(row.seed).toHaveLength(32);
});

test('it keeps explicit overrides', () => {
  const row = createMockActivityRow({ avatarId: 'avatar-1', scopeId: 'node_9' });

  expect(row).toMatchObject({ avatarId: 'avatar-1', scopeId: 'node_9' });
});
