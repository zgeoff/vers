import * as schema from '@vers/postgres-schema';
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

test('it deletes a session', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller, user } = await setupTest({ db });

  const session = {
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    id: 'test_session_id',
    ipAddress: '127.0.0.1',
    refreshToken: 'test_refresh_token',
    updatedAt: new Date(),
    userID: user.id,
  };

  await db.insert(schema.sessions).values(session);

  const result = await caller.deleteSession({
    id: session.id,
    userID: user.id,
  });

  expect(result).toStrictEqual({});

  const deletedSession = await db.query.sessions.findFirst({
    where: (sessions, operators) => operators.eq(sessions.id, session.id),
  });

  expect(deletedSession).toBeUndefined();
});

test('it does not delete a session when userID does not match', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller, user } = await setupTest({ db });

  const session = {
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    id: 'test_session_id',
    ipAddress: '127.0.0.1',
    refreshToken: 'test_refresh_token',
    updatedAt: new Date(),
    userID: user.id,
  };

  await db.insert(schema.sessions).values(session);

  const result = await caller.deleteSession({
    id: session.id,
    userID: 'different_user_id',
  });

  expect(result).toStrictEqual({});

  // verify session was not deleted
  const existingSession = await db.query.sessions.findFirst({
    where: (sessions, operators) => operators.eq(sessions.id, session.id),
  });

  expect(existingSession).not.toBeNull();
});
