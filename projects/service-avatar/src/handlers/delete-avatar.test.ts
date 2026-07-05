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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
async function setupTest(config: TestConfig) {
  const caller = createCaller({ db: config.db });
  const user = await createTestUser(config.db);

  return { caller, user };
}

test('it deletes an avatar', async () => {
  await using handle = await createTestDB();

  const { db } = handle;
  const { caller, user } = await setupTest({ db });

  const avatar = await caller.createAvatar({
    class: Class.Brute,
    name: 'TestAvatar',
    userID: user.id,
  });

  await caller.deleteAvatar({
    id: avatar.id,
    userID: user.id,
  });

  const deleted = await db.query.avatars.findFirst({
    where: (avatars, operators) => operators.eq(avatars.id, avatars.id),
  });

  expect(deleted).toBeUndefined();
});

test('it throws an error when avatar is not found', async () => {
  await using handle = await createTestDB();

  const { db } = handle;
  const { caller, user } = await setupTest({ db });

  await expect(
    caller.deleteAvatar({
      id: createId(),
      userID: user.id,
    }),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
    message: 'Avatar not found',
  });
});
