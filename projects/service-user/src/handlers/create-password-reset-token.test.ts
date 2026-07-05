import type * as schema from '@vers/postgres-schema';
import { createTestDB, createTestUser } from '@vers/service-test-utils';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { expect, test } from 'vitest';
import { router } from '../router';
import { t } from '../t';

const createCaller = t.createCallerFactory(router);

interface TestConfig {
  db: PostgresJsDatabase<typeof schema>;
  user?: Partial<typeof schema.users.$inferInsert>;
}

function setupTest(config: TestConfig) {
  const caller = createCaller({ db: config.db });

  return { caller };
}

test('it creates a password reset token for an existing user', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const user = await createTestUser(db);

  const { caller } = setupTest({ db });

  const result = await caller.createPasswordResetToken({
    id: user.id,
  });

  expect(result).toStrictEqual({
    resetToken: expect.any(String),
  });

  const updatedUser = await db.query.users.findFirst({
    where: (users, operators) => operators.eq(users.id, user.id),
  });

  expect(updatedUser?.passwordResetToken).toBe(result.resetToken);
  expect(updatedUser?.passwordResetTokenExpiresAt).toBeDate();
  expect(updatedUser?.passwordResetTokenExpiresAt).toBeAfter(new Date());
  expect(updatedUser?.passwordResetTokenExpiresAt).toBeBefore(
    new Date(Date.now() + 11 * 60 * 1000),
  );
});

test('it updates the user record with the new reset token', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const user = await createTestUser(db);

  const { caller } = setupTest({ db });

  const firstResult = await caller.createPasswordResetToken({
    id: user.id,
  });

  const secondResult = await caller.createPasswordResetToken({
    id: user.id,
  });

  expect(firstResult.resetToken).not.toBe(secondResult.resetToken);

  const updatedUser = await db.query.users.findFirst({
    where: (users, operators) => operators.eq(users.id, user.id),
  });

  expect(updatedUser?.passwordResetToken).toBe(secondResult.resetToken);
});

test('it throws an error if the user does not exist', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  await expect(
    caller.createPasswordResetToken({
      id: 'nonexistent_id',
    }),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
    message: 'User not found',
  });
});

test('it throws an error if the user has no password', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const user = await createTestUser(db, { password: null });

  const { caller } = setupTest({ db });

  await expect(
    caller.createPasswordResetToken({
      id: user.id,
    }),
  ).rejects.toMatchObject({
    code: 'BAD_REQUEST',
    message: 'User has no password',
  });
});
