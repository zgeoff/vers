import { expect, test } from 'bun:test';
import { buildOfflineRootSubmission } from './build-offline-root-submission';
import { createMockActivityData } from './test-utils/factories/create-mock-activity-data';

test('it projects a client-minted root row down to the twelve wire fields advanceActivity accepts', () => {
  const playedAt = new Date();

  const row = createMockActivityData({
    avatarID: 'avatar_1',
    buildSnapshot: { level: 3, xp: 120 },
    contentVersion: '2',
    playedAt,
    predecessorActivityID: 'act_predecessor',
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: 'a'.repeat(32),
    simVersion: '0.0.0-dev',
    startChainIndex: 4,
    startHash: 'b'.repeat(64),
    startKey: 'start_key_1',
  });

  expect(buildOfflineRootSubmission(row)).toStrictEqual({
    avatarID: 'avatar_1',
    buildSnapshot: { level: 3, xp: 120 },
    contentVersion: '2',
    playedAt,
    predecessorActivityID: 'act_predecessor',
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: 'a'.repeat(32),
    simVersion: '0.0.0-dev',
    startChainIndex: 4,
    startHash: 'b'.repeat(64),
    startKey: 'start_key_1',
  });
});

test('it never carries the server-derived encounter and key/secret stamps', () => {
  const row = createMockActivityData({ startKey: 'start_key_2' });

  expect(buildOfflineRootSubmission(row)).not.toContainAnyKeys([
    'encounterNode',
    'keyVersion',
    'secretRef',
    'secretVersion',
  ]);
});

test('it throws when the row carries no start key', () => {
  const row = createMockActivityData({ startKey: null });

  expect(() => buildOfflineRootSubmission(row)).toThrow();
});
