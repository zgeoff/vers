import { createId } from '@paralleldrive/cuid2';
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

test('it updates an avatar name', async () => {
  await using handle = await createTestDB();

  const { db } = handle;
  const { caller, user } = await setupTest({ db });

  const avatar = await caller.createAvatar({
    class: Class.Brute,
    name: 'OriginalName',
    userID: user.id,
  });

  const result = await caller.updateAvatar({
    id: avatar.id,
    name: 'UpdatedName',
    userID: user.id,
  });

  expect(result).toStrictEqual({
    updatedID: avatar.id,
  });

  const updated = await db.query.avatars.findFirst({
    where: (avatars, operators) => operators.eq(avatars.id, avatars.id),
  });

  expect(updated).toStrictEqual({
    ...avatar,
    name: 'UpdatedName',
    updatedAt: expect.any(Date),
  });
});

test('it throws an error when avatar is not found', async () => {
  await using handle = await createTestDB();

  const { db } = handle;
  const { caller, user } = await setupTest({ db });

  await expect(
    caller.updateAvatar({
      id: createId(),
      name: 'NewName',
      userID: user.id,
    }),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
    message: 'Avatar not found',
  });
});
