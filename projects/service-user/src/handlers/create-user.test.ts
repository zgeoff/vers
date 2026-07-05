import type * as schema from '@vers/postgres-schema';
import { createTestDB } from '@vers/service-test-utils';
import bcrypt from 'bcryptjs';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import invariant from 'tiny-invariant';
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

test('it creates a user with a hashed password', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const password = 'password123';

  const result = await caller.createUser({
    email: 'user@test.com',
    name: 'Test User',
    password,
    username: 'test_user',
  });

  expect(result).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    createdAt: expect.any(Date),
    email: 'user@test.com',
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    id: expect.any(String),
    name: 'Test User',
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    seed: expect.any(Number),
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    updatedAt: expect.any(Date),
    username: 'test_user',
  });

  const user = await db.query.users.findFirst({
    where: (users, operators) => operators.eq(users.email, 'user@test.com'),
  });

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  invariant(user?.passwordHash, 'user with password hash must be created');

  await expect(bcrypt.compare(password, user.passwordHash)).resolves.toBeTrue();
});

test('it throws an error if a user with that email already exists', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  await caller.createUser({
    email: 'user@test.com',
    name: 'Test User',
    password: 'password123',
    username: 'test_user',
  });

  // try to create another user with the same email
  await expect(
    caller.createUser({
      email: 'user@test.com',
      name: 'Another User',
      password: 'password456',
      username: 'another_user',
    }),
  ).rejects.toMatchObject({
    code: 'CONFLICT',
    message: 'A user with that email already exists',
  });
});

test('it throws an error if a user with that username already exists', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  await caller.createUser({
    email: 'user1@test.com',
    name: 'Test User',
    password: 'password123',
    username: 'test_user',
  });

  // try to create another user with the same username
  await expect(
    caller.createUser({
      email: 'user2@test.com',
      name: 'Another User',
      password: 'password456',
      username: 'test_user',
    }),
  ).rejects.toMatchObject({
    code: 'CONFLICT',
    message: 'A user with that username already exists',
  });
});
