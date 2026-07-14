import { faker } from '@faker-js/faker';
import type { LatestActivityProgress } from '../../resync/types';
import { createMockActivityData } from './create-mock-activity-data';

export function createMockLatestActivityProgress(
  overrides: Partial<LatestActivityProgress> = {},
): LatestActivityProgress {
  return {
    activity: createMockActivityData(),
    anchor: null,
    appendedHead: 0,
    serverTime: faker.date.recent(),
    verifiedHead: 0,
    ...overrides,
  };
}
