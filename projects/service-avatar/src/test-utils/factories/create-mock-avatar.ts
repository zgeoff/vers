import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { Avatars } from '@vers/db';
import type { Insertable } from 'kysely';

/**
 * A plain, unpersisted avatar row with faker-generated defaults. Never requires a parent —
 * `userId` defaults to a random id, not a real user's.
 */
export function createMockAvatar(
  overrides: Partial<Insertable<Avatars>> = {},
): Insertable<Avatars> {
  return {
    class: 'brute',
    id: createId(),
    name: faker.string.alpha({ casing: 'lower', length: { max: 12, min: 6 } }),
    userId: createId(),
    ...overrides,
  };
}
