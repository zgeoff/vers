import * as schema from '@vers/postgres-schema';
import { createTestDB, createTestUser } from '@vers/service-test-utils';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { expect, test } from 'vitest';
import { router } from '../router';
import { t } from '../t';

const createCaller = t.createCallerFactory(router);

interface TestConfig {
  db: PostgresJsDatabase<typeof schema>;
}

function setupTest(config: TestConfig) {
  const caller = createCaller({ db: config.db });

  return { caller };
}

test('it changes the user password', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const user = await createTestUser(db);

  const { caller } = setupTest({ db });

  const result = await caller.changePassword({
    id: user.id,
    password: 'newpassword123',
  });

  expect(result).toStrictEqual({ updatedID: user.id });

  const updatedUser = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
  });

  expect(updatedUser).toBeDefined();
  expect(updatedUser?.passwordHash).not.toBe(user.passwordHash);
});

test('it throws an error if the user does not exist', async () => {
  await using handle = await createTestDB();

  const { db } = handle;
  const { caller } = setupTest({ db });

  await expect(
    caller.changePassword({
      id: 'non-existent-id',
      password: 'newpassword123',
    }),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
    message: 'User not found',
  });
});
