import { faker } from '@faker-js/faker';
import type { RevealedRewardData } from '../../lib/activity/types';

export function createMockRevealedReward(
  overrides: Partial<RevealedRewardData> = {},
): RevealedRewardData {
  return {
    chainIndex: faker.number.int({ max: 20, min: 0 }),
    item: {
      affixes: [],
      baseID: faker.string.alphanumeric({ casing: 'lower', length: 12 }),
      contentVersion: '0.0.0-dev',
      rarityID: 'common',
    },
    ordinal: faker.number.int({ max: 3, min: 0 }),
    ...overrides,
  };
}
