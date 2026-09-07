import { faker } from '@faker-js/faker';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { buildLevelFromXP } from '@vers/idle-core';
import type { LatestActivityProgress } from '../../resync/types';

export function createMockLatestActivityProgress(
  overrides: Partial<LatestActivityProgress> = {},
): LatestActivityProgress {
  const xp = faker.number.int({ max: 5000, min: 0 });

  return {
    activity: createMockActivityData(),
    anchor: null,
    appendedHead: 0,
    failureAction: 'abort',
    isWriter: true,
    optimisticBuild: { level: buildLevelFromXP(xp), xp },
    serverTime: faker.date.recent(),
    verifiedHead: 0,
    ...overrides,
  };
}
