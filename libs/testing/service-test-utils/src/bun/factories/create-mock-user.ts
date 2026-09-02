import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { Users } from '@vers/db';
import { createSeed } from '@vers/game-utils';
import type { Insertable } from 'kysely';

export function createMockUser(overrides: Partial<Insertable<Users>> = {}): Insertable<Users> {
  const now = new Date();

  return {
    createdAt: now,
    email: faker.internet.email(),
    id: createId(),
    name: faker.person.fullName(),
    passwordHash: null,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
    seed: createSeed(),
    updatedAt: now,
    username: faker.internet.username(),
    ...overrides,
  };
}
