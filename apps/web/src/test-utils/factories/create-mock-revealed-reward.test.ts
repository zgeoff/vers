import { expect, test } from 'bun:test';
import { createMockRevealedReward } from './create-mock-revealed-reward';

test('it builds a reward slot with a full item by default', () => {
  const reward = createMockRevealedReward();

  expect(reward).toStrictEqual({
    chainIndex: expect.toBeNumber(),
    item: {
      affixes: [],
      baseID: expect.toBeString(),
      contentVersion: '0.0.0-dev',
      rarityID: 'common',
    },
    ordinal: expect.toBeNumber(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const reward = createMockRevealedReward({ chainIndex: 7, ordinal: 2 });

  expect(reward).toStrictEqual({
    chainIndex: 7,
    item: {
      affixes: [],
      baseID: expect.toBeString(),
      contentVersion: '0.0.0-dev',
      rarityID: 'common',
    },
    ordinal: 2,
  });
});
