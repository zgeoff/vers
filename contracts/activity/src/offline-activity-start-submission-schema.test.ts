import { expect, test } from 'bun:test';
import { OfflineActivityStartSubmissionSchema } from './offline-activity-start-submission-schema';

test('it accepts a well-formed activity-start submission', () => {
  const result = OfflineActivityStartSubmissionSchema.safeParse({
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '2',
    playedAt: null,
    predecessorActivityID: null,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: '0123456789abcdef0123456789abcdef',
    simVersion: 'engine_hash',
    startChainIndex: 0,
    startHash: 'start_hash',
    startKey: 'start_act_1',
  });

  expect(result.success).toBeTrue();
});

test('it rejects an activity-start submission missing its startKey', () => {
  const result = OfflineActivityStartSubmissionSchema.safeParse({
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '2',
    playedAt: null,
    predecessorActivityID: null,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: '0123456789abcdef0123456789abcdef',
    simVersion: 'engine_hash',
    startChainIndex: 0,
    startHash: 'start_hash',
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['startKey'] }));
});

test('it rejects a nonnumeric contentVersion', () => {
  const result = OfflineActivityStartSubmissionSchema.safeParse({
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '0.0.0-dev',
    playedAt: null,
    predecessorActivityID: null,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: '0123456789abcdef0123456789abcdef',
    simVersion: 'engine_hash',
    startChainIndex: 0,
    startHash: 'start_hash',
    startKey: 'start_act_1',
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['contentVersion'] }),
  );
});
