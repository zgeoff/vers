import { faker } from '@faker-js/faker';
import type { ActivityStartedCheckpoint } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';

export function createMockStartedCheckpoint(
  overrides: Partial<ActivityStartedCheckpoint> = {},
): ActivityStartedCheckpoint {
  const seed = faker.string.alphanumeric({ casing: 'lower', length: 16 });

  return {
    nextSeed: seed,
    rewards: { xp: 0 },
    rewardSlots: [],
    seed,
    time: 0,
    type: ActivityCheckpointType.Started,
    ...overrides,
  };
}
