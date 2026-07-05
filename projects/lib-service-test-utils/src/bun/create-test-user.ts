import { createHash } from 'node:crypto';
import { createId } from '@paralleldrive/cuid2';
import type { DB, Users } from '@vers/db';
import { createSeed } from '@vers/game-utils';
import bcrypt from 'bcryptjs';
import type { Insertable, Kysely, Selectable } from 'kysely';

type TestUserRow = Omit<Insertable<Users>, 'id' | 'passwordHash' | 'passwordResetToken'>;

interface CreateTestUserData extends Partial<TestUserRow> {
  password?: null | string;
  passwordAlgorithm?: 'argon2id' | 'bcrypt';
  resetToken?: string;
}

interface TestUser {
  resetToken: string | undefined;
  user: Selectable<Users>;
}

/**
 * Matches the legacy production hasher's cost factor so bcrypt-path
 * regression tests exercise a realistically expensive hash.
 */
const LEGACY_BCRYPT_COST_FACTOR = 12;

/**
 * Inserts a user for bun-test suites via kysely. Hashes `password` as
 * argon2id by default, or bcrypt when `passwordAlgorithm: 'bcrypt'` (for
 * legacy-hash regression coverage). A `resetToken` plaintext is hashed with
 * sha256 into `passwordResetToken` and echoed back on the return value for
 * callers that need to present it to a reset flow.
 */
export async function createTestUser(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  db: Kysely<DB>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  data: CreateTestUserData = {},
): Promise<TestUser> {
  const now = new Date();

  let passwordHash = null;

  if (data.password !== null) {
    const password = data.password ?? 'password123';

    passwordHash =
      data.passwordAlgorithm === 'bcrypt'
        ? await bcrypt.hash(password, LEGACY_BCRYPT_COST_FACTOR)
        : await Bun.password.hash(password, { algorithm: 'argon2id' });
  }

  const passwordResetToken =
    data.resetToken === undefined
      ? null
      : createHash('sha256').update(data.resetToken).digest('hex');

  const { password, passwordAlgorithm, resetToken, ...overrides } = data;

  const row = {
    createdAt: now,
    email: 'user@test.com',
    id: createId(),
    name: 'Test User',
    passwordHash,
    passwordResetToken,
    passwordResetTokenExpiresAt: null,
    seed: createSeed(),
    updatedAt: now,
    username: 'test_user',
    ...overrides,
  } satisfies Insertable<Users>;

  const user = await db.insertInto('users').values(row).returningAll().executeTakeFirstOrThrow();

  return { resetToken, user };
}
