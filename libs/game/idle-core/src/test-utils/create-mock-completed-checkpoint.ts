import { faker } from '@faker-js/faker';
import type { ActivityCompletedCheckpoint } from '../types';
import { ActivityCheckpointType } from '../types';

export function createMockCompletedCheckpoint(
  overrides: Partial<ActivityCompletedCheckpoint> = {},
): ActivityCompletedCheckpoint {
  return {
    nextSeed: faker.string.alphanumeric({ casing: 'lower', length: 16 }),
    rewards: { xp: faker.number.int({ max: 100, min: 1 }) },
    time: faker.number.int({ max: 60_000, min: 1 }),
    type: ActivityCheckpointType.Completed,
    ...overrides,
  };
}
