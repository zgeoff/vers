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

function setupTest(config: TestConfig) {
  const caller = createCaller({ db: config.db });

  return { caller };
}

test('it gets a user by ID', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const user = await createTestUser(db);

  const { caller } = setupTest({ db });

  const result = await caller.getUser({
    id: user.id,
  });

  expect(result).toStrictEqual(user);
});

test('it gets a user by email', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const user = await createTestUser(db);

  const { caller } = setupTest({ db });

  const result = await caller.getUser({
    email: user.email,
  });

  expect(result).toStrictEqual(user);
});

test('it returns null for a non-existent user', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const result = await caller.getUser({
    id: 'non-existent-id',
  });

  expect(result).toBeNull();
});
