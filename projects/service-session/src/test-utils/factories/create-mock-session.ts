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
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    id: createId(),
    ipAddress: faker.internet.ip(),
    previousRefreshToken: null,
    refreshToken: null,
    userId: createId(),
    verified: false,
    ...overrides,
  };
}
