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

test('it retrieves all avatars for a user', async () => {
  await using handle = await createTestDB();

  const { db } = handle;
  const { caller, user } = await setupTest({ db });

  const avatar = await caller.createAvatar({
    class: Class.Brute,
    name: 'TestAvatar',
    userID: user.id,
  });

  const result = await caller.getAvatars({
    userID: user.id,
  });

  expect(result).toStrictEqual([avatar]);
});

test('it returns an empty array when no avatarxist', async () => {
  await using handle = await createTestDB();

  const { db } = handle;
  const { caller, user } = await setupTest({ db });

  const result = await caller.getAvatars({
    userID: user.id,
  });

  expect(result).toStrictEqual([]);
});
