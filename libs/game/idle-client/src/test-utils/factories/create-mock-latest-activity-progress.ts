import { faker } from '@faker-js/faker';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import type { LatestActivityProgress } from '../../resync/types';

export function createMockLatestActivityProgress(
  overrides: Partial<LatestActivityProgress> = {},
): LatestActivityProgress {
  return {
    activity: createMockActivityData(),
    anchor: null,
    appendedHead: 0,
    failureAction: 'abort',
    serverTime: faker.date.recent(),
    verifiedHead: 0,
    ...overrides,
  };
}
