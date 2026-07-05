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

test('it updates the provided user', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const user = await createTestUser(db);

  const { caller } = setupTest({ db });

  const update = {
    name: 'Updated Name',
    username: 'updated_username',
  };

  const result = await caller.updateUser({
    id: user.id,
    ...update,
  });

  expect(result).toStrictEqual({ updatedID: user.id });

  const updatedUser = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
  });

  expect(updatedUser).toStrictEqual({
    ...user,
    name: 'Updated Name',
    updatedAt: expect.any(Date),
    username: 'updated_username',
  });

  expect(updatedUser?.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime());
});

test('it allows partial updating', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const user = await createTestUser(db);

  const { caller } = setupTest({ db });

  const update = {
    name: 'Updated Name',
  };

  const result = await caller.updateUser({
    id: user.id,
    ...update,
  });

  const updatedUser = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
  });

  expect(result).toStrictEqual({ updatedID: user.id });

  expect(updatedUser).toStrictEqual({
    ...user,
    name: 'Updated Name',
    updatedAt: expect.any(Date),
  });
});

test('should throw an error if the user is not found', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const update = {
    id: 'non-existent-id',
    name: 'Updated Name',
  } as const;

  await expect(caller.updateUser(update)).rejects.toMatchObject({
    code: 'NOT_FOUND',
    message: 'User not found',
  });
});
