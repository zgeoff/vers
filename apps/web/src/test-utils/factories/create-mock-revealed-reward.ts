import { faker } from '@faker-js/faker';
import type { RevealedReward } from '../../lib/activity/types';

export function createMockRevealedReward(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- RevealedReward is zod-inferred from the contract client's return type; its nested item fields have no readonly form
  overrides: Partial<RevealedReward> = {},
): RevealedReward {
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
