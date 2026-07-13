import { faker } from '@faker-js/faker';
import type { ActivityStartedCheckpoint } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';

/**
 * `Started` consumes nothing from the seed chain, so `nextSeed` defaults to the same value as
 * `seed`.
 */
export function createMockStartedCheckpoint(
  overrides: Partial<ActivityStartedCheckpoint> = {},
): ActivityStartedCheckpoint {
  const seed = faker.string.alphanumeric({ casing: 'lower', length: 16 });

  return {
    nextSeed: seed,
    rewards: { xp: 0 },
    seed,
    time: 0,
    type: ActivityCheckpointType.Started,
    ...overrides,
  };
}
