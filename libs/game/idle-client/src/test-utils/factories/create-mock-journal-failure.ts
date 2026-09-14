import { faker } from '@faker-js/faker';
import type { JournalFailure } from '../../types';

export function createMockJournalFailure(
  overrides: Readonly<Partial<JournalFailure>> = {},
): JournalFailure {
  return {
    activityID: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    kind: 'write',
    receivedVersion: faker.number.int({ max: 50, min: 1 }),
    ...overrides,
  };
}
