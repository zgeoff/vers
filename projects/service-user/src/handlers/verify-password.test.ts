import type * as schema from '@vers/postgres-schema';
import { createTestDB, createTestUser } from '@vers/service-test-utils';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { expect, test } from 'vitest';
import { router } from '../router';
import { t } from '../t';

const createCaller = t.createCallerFactory(router);

interface TestConfig {
  db: PostgresJsDatabase<typeof schema>;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function setupTest(config: TestConfig) {
  const caller = createCaller({ db: config.db });

  return { caller };
}

test('it verifies a correct password', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const user = await createTestUser(db, { password: 'password123' });

  const result = await caller.verifyPassword({
    email: user.email,
    password: 'password123',
  });

  expect(result).toStrictEqual({ success: true });
});

test('it returns a failure payload when the password is incorrect', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const user = await createTestUser(db, { password: 'password123' });

  const result = await caller.verifyPassword({
    email: user.email,
    password: 'wrongpassword',
  });

  expect(result).toStrictEqual({ success: false });
});

test('it rejects a non-existent user', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  await expect(
    caller.verifyPassword({
      email: 'nonexistent@test.com',
      password: 'password123',
    }),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
    message: 'User not found',
  });
});

test('it rejects a user without a password set', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const user = await createTestUser(db, { password: null });

  await expect(
    caller.verifyPassword({
      email: user.email,
      password: 'password123',
    }),
  ).rejects.toMatchObject({
    code: 'BAD_REQUEST',
    message: 'User does not have a password set',
  });
});
