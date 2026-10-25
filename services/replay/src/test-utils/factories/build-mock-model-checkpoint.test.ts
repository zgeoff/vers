import { expect, test } from 'bun:test';
import { buildMockModelCheckpoint } from './build-mock-model-checkpoint';

test('it builds a progress checkpoint whose forged entry claims one more XP under the same hash', () => {
  expect(buildMockModelCheckpoint({ version: 2 })).toStrictEqual({
    entry: {
      hash: 'hash-2',
      payload: {
        chainIndex: 2,
        entropySource: 'server-key',
        nextSeed: 'seed-2',
        rewards: { xp: 10 },
        seed: 'seed-1',
        time: 2000,
        type: 'progress',
      },
      prevHash: 'hash-1',
      version: 2,
    },
    forgedEntry: {
      hash: 'hash-2',
      payload: {
        chainIndex: 2,
        entropySource: 'server-key',
        nextSeed: 'seed-2',
        rewards: { xp: 11 },
        seed: 'seed-1',
        time: 2000,
        type: 'progress',
      },
      prevHash: 'hash-1',
      version: 2,
    },
    rewardOrdinals: [],
    type: 'progress',
    xp: 10,
  });
});

test('it applies the given type, XP and reward ordinals', () => {
  expect(
    buildMockModelCheckpoint({ rewardOrdinals: [0, 1], type: 'completed', version: 4, xp: 120 }),
  ).toMatchObject({
    entry: { payload: { rewards: { xp: 120 }, type: 'completed' } },
    rewardOrdinals: [0, 1],
    type: 'completed',
    xp: 120,
  });
});
