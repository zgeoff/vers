import { expect, test } from 'bun:test';
import { ActivityDataSchema } from './activity-data-schema';

test('it accepts a well-formed activity', () => {
  const result = ActivityDataSchema.safeParse({
    appendedAt: null,
    appendedHead: 0,
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '0.0.0-dev',
    createdAt: new Date(),
    encounterNode: { difficulty: 1 },
    id: 'act_1',
    keyVersion: 1,
    lastHash: 'hash_start',
    scopeID: 'node_1',
    scopeType: 'world_map_node',
    seed: 'seed_1',
    simVersion: '0.0.0-dev',
    startChainIndex: 0,
    startHash: 'hash_start',
    startedAt: new Date(),
    status: 'active',
    stoppedAt: null,
    updatedAt: new Date(),
    verifiedAt: null,
    verifiedHead: 0,
  });

  expect(result.success).toBeTrue();
});

test('it rejects an activity with an invalid status', () => {
  const result = ActivityDataSchema.safeParse({
    appendedAt: null,
    appendedHead: 0,
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '0.0.0-dev',
    createdAt: new Date(),
    encounterNode: { difficulty: 1 },
    id: 'act_1',
    keyVersion: 1,
    lastHash: 'hash_start',
    scopeID: 'node_1',
    scopeType: 'world_map_node',
    seed: 'seed_1',
    simVersion: '0.0.0-dev',
    startChainIndex: 0,
    startHash: 'hash_start',
    startedAt: new Date(),
    status: 'paused',
    stoppedAt: null,
    updatedAt: new Date(),
    verifiedAt: null,
    verifiedHead: 0,
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['status'] }));
});
