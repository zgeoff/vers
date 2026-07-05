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

test('it creates a session with a short session duration', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller, user } = await setupTest({ db });

  const result = await caller.createSession({
    ipAddress: '127.0.0.1',
    rememberMe: false,
    userID: user.id,
  });

  expect(result).toStrictEqual({
    createdAt: expect.any(Date),
    expiresAt: expect.any(Date),
    id: expect.any(String),
    ipAddress: '127.0.0.1',
    updatedAt: expect.any(Date),
    userID: user.id,
    verified: false,
  });
});

test('it creates a session with a long session duration', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller, user } = await setupTest({ db });

  const result = await caller.createSession({
    ipAddress: '127.0.0.1',
    rememberMe: true,
    userID: user.id,
  });

  expect(result).toStrictEqual({
    createdAt: expect.any(Date),
    expiresAt: expect.any(Date),
    id: expect.any(String),
    ipAddress: '127.0.0.1',
    updatedAt: expect.any(Date),
    userID: user.id,
    verified: false,
  });
});
