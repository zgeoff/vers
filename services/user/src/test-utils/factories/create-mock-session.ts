import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { Sessions } from '@vers/db';
import type { Insertable } from 'kysely';

export function createMockSession(
  overrides: Partial<Insertable<Sessions>> = {},
): Insertable<Sessions> {
  return {
    expiresAt: faker.date.future(),
    id: createId(),
    ipAddress: faker.internet.ip(),
    userId: createId(),
    ...overrides,
  };
}
