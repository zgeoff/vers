import { expect, test } from 'bun:test';
import { OfflineRootSubmissionSchema } from './offline-root-submission-schema';

test('it accepts a well-formed root submission', () => {
  const result = OfflineRootSubmissionSchema.safeParse({
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '2',
    encounterNode: { difficulty: 1 },
    keyVersion: 1,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    secretRef: 'worldmap',
    secretVersion: 1,
    seed: '0123456789abcdef0123456789abcdef',
    simVersion: 'engine_hash',
    startChainIndex: 0,
    startHash: 'start_hash',
    startKey: 'root_act_1',
  });

  expect(result.success).toBeTrue();
});

test('it rejects a root submission missing its startKey', () => {
  const result = OfflineRootSubmissionSchema.safeParse({
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '2',
    encounterNode: { difficulty: 1 },
    keyVersion: 1,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    secretRef: 'worldmap',
    secretVersion: 1,
    seed: '0123456789abcdef0123456789abcdef',
    simVersion: 'engine_hash',
    startChainIndex: 0,
    startHash: 'start_hash',
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['startKey'] }));
});
