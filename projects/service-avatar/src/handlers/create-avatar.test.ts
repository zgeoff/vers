import { Class } from '@vers/data';
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

async function setupTest(config: TestConfig) {
  const caller = createCaller({ db: config.db });
  const user = await createTestUser(config.db);

  return { caller, user };
}

test('it creates an avatar with default values', async () => {
  await using handle = await createTestDB();

  const { db } = handle;
  const { caller, user } = await setupTest({ db });

  const input = {
    class: Class.Brute,
    name: 'TestAvatar',
    userID: user.id,
  };

  const result = await caller.createAvatar(input);

  expect(result).toStrictEqual({
    class: input.class,
    createdAt: expect.any(Date),
    id: expect.any(String),
    level: 1,
    name: input.name,
    updatedAt: expect.any(Date),
    userID: input.userID,
    xp: 0,
  });

  const avatar = await db.query.avatars.findFirst({
    where: (avatars, operators) => operators.eq(avatars.id, result.id),
  });

  expect(avatar).toStrictEqual(result);
});

test('it throws an error if an avatar with the same name already exists', async () => {
  await using handle = await createTestDB();

  const { db } = handle;
  const { caller, user } = await setupTest({ db });

  await caller.createAvatar({
    class: Class.Brute,
    name: 'Avatar',
    userID: user.id,
  });

  await expect(
    caller.createAvatar({
      class: Class.Brute,
      name: 'Avatar',
      userID: user.id,
    }),
  ).rejects.toMatchObject({
    code: 'CONFLICT',
    message: 'An avatar with that name already exists',
  });
});

test('it throws an error if the name is not alphabetic', async () => {
  await using handle = await createTestDB();

  const { db } = handle;
  const { caller, user } = await setupTest({ db });

  await expect(
    caller.createAvatar({
      class: Class.Brute,
      name: 'Avatar #1',
      userID: user.id,
    }),
  ).rejects.toMatchObject({
    cause: {
      issues: [
        {
          message: 'Name must be alphabetic with no spaces or special characters',
          path: ['name'],
        },
      ],
    },
    code: 'BAD_REQUEST',
  });
});

test('it throws an error if the name is too long', async () => {
  await using handle = await createTestDB();

  const { db } = handle;
  const { caller, user } = await setupTest({ db });

  await expect(
    caller.createAvatar({
      class: Class.Brute,
      name: 'abcdefghijklmnopqrstuvwxyz',
      userID: user.id,
    }),
  ).rejects.toMatchObject({
    cause: {
      issues: [
        {
          message: 'Name must be less than 16 characters',
          path: ['name'],
        },
      ],
    },
    code: 'BAD_REQUEST',
  });
});

test('it throws an error if the name is too short', async () => {
  await using handle = await createTestDB();

  const { db } = handle;
  const { caller, user } = await setupTest({ db });

  await expect(
    caller.createAvatar({
      class: Class.Brute,
      name: 'a',
      userID: user.id,
    }),
  ).rejects.toMatchObject({
    cause: {
      issues: [
        {
          message: 'Name must be at least 3 characters',
          path: ['name'],
        },
      ],
    },
    code: 'BAD_REQUEST',
  });
});
