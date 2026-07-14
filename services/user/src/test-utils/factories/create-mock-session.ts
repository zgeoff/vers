import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { Sessions } from '@vers/db';
import type { Insertable } from 'kysely';

/**
 * A plain, unpersisted session row with faker-generated defaults. Never requires a parent —
 * `userId` defaults to a random id, not a real user's.
 */
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
