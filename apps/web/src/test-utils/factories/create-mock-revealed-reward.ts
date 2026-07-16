import { faker } from '@faker-js/faker';
import type { RevealedRewardData } from '../../lib/activity/types';

export function createMockRevealedReward(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- overrides spread into the mutable wire shape mock handlers must return; a readonly form cannot
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
