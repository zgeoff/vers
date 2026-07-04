import { createSeed } from '@vers/game-utils';
import * as schema from '@vers/postgres-schema';
import bcrypt from 'bcryptjs';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * Matches the cost factor `@vers/service-utils`'s `hashPassword` uses —
 * seeded test users must hash the same way production login does. Inlined
 * rather than imported to avoid a package dependency cycle: `service-utils`
 * itself depends on this package in its own tests.
 */
const PASSWORD_HASH_COST_FACTOR = 12;

type TestUserData = Partial<
  Omit<typeof schema.users.$inferSelect, 'passwordHash'> & {
    password?: null | string;
  }
>;

export async function createTestUser(
  db: PostgresJsDatabase<typeof schema>,
  data: TestUserData = {},
): Promise<typeof schema.users.$inferSelect> {
  const now = new Date();

  let passwordHash = null;

  if (data.password !== null) {
    passwordHash = await bcrypt.hash(
      data.password ?? 'password123',
      PASSWORD_HASH_COST_FACTOR,
    );
  }

  const user = {
    createdAt: now,
    email: 'user@test.com',
    id: 'test_id',
    name: 'Test User',
    passwordHash,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
    seed: createSeed(),
    updatedAt: now,
    username: 'test_user',
    ...data,
  } satisfies typeof schema.users.$inferInsert;

  await db.insert(schema.users).values(user);

  return user;
}
