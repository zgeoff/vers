import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { Avatars } from '@vers/db';
import type { Insertable } from 'kysely';

export function createMockAvatar(
  overrides: Partial<Insertable<Avatars>> = {},
): Insertable<Avatars> {
  return {
    id: createId(),
    mode: 'trade',
    name: faker.string.alpha({ casing: 'lower', length: { max: 12, min: 6 } }),
    seed: faker.number.int({ max: 2 ** 31 - 1, min: 0 }),
    userId: createId(),
    ...overrides,
  };
}
