import * as schema from '@vers/postgres-schema';
import { createTestDB, createTestUser, createTestVerification } from '@vers/service-test-utils';
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

test('it updates the provided user email', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const user = await createTestUser(db);

  const { caller } = setupTest({ db });

  const update = {
    email: 'updated@test.com',
    id: user.id,
  };

  const result = await caller.updateEmail(update);

  expect(result).toStrictEqual({ updatedID: user.id });

  const updatedUser = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
  });

  expect(updatedUser).toStrictEqual({
    ...user,
    email: 'updated@test.com',
    updatedAt: expect.any(Date),
  });

  expect(updatedUser?.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime());
});

test('it updates a users 2FA verification', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const user = await createTestUser(db, { email: 'test@test.com' });
  const verification = await createTestVerification(db, {
    target: user.email,
    type: '2fa',
  });

  const { caller } = setupTest({ db });

  const update = {
    email: 'updated@test.com',
    id: user.id,
  };

  await caller.updateEmail(update);

  const updatedVerification = await db.query.verifications.findFirst({
    where: eq(schema.verifications.id, verification.id),
  });

  expect(updatedVerification).toStrictEqual({
    ...verification,
    target: 'updated@test.com',
  });
});

test('it updates a users 2FA setup verification', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const user = await createTestUser(db, { email: 'test@test.com' });
  const verification = await createTestVerification(db, {
    target: user.email,
    type: '2fa-setup',
  });

  const { caller } = setupTest({ db });

  const update = {
    email: 'updated@test.com',
    id: user.id,
  };

  await caller.updateEmail(update);

  const updatedVerification = await db.query.verifications.findFirst({
    where: eq(schema.verifications.id, verification.id),
  });

  expect(updatedVerification).toStrictEqual({
    ...verification,
    target: 'updated@test.com',
  });
});

test('should throw an error if the user is not found', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const update = {
    email: 'updated@test.com',
    id: 'non-existent-id',
  } as const;

  await expect(caller.updateEmail(update)).rejects.toMatchObject({
    code: 'NOT_FOUND',
    message: 'User not found',
  });
});
