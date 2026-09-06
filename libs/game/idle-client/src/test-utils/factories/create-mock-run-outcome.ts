import { faker } from '@faker-js/faker';
import { ActivityCheckpointType } from '@vers/idle-core';
import type { RunOutcome } from '../../worker/run-outcome-schema';

export function createMockRunOutcome(overrides: Readonly<Partial<RunOutcome>> = {}): RunOutcome {
  return {
    activityID: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    avatarID: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    kind: ActivityCheckpointType.Failed,
    xp: faker.number.int({ max: 500, min: 0 }),
    ...overrides,
  };
}
