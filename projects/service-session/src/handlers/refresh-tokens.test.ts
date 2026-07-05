import { createId } from '@paralleldrive/cuid2';
import * as schema from '@vers/postgres-schema';
import { createTestDB, createTestUser } from '@vers/service-test-utils';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { afterEach, expect, test, vi } from 'vitest';
import * as consts from '../consts';
import { router } from '../router';
import { t } from '../t';
import { createJWT } from '../utils/create-jwt';

vi.mock(import('../utils/create-jwt'));

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

afterEach(() => {
  vi.clearAllMocks();
});

test('it refreshes tokens for a young session without rotating the refresh token', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller, user } = await setupTest({ db });

  const session = {
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + consts.SESSION_DURATION_LONG),
    id: createId(),
    ipAddress: '127.0.0.1',
    refreshToken: 'existing-refresh-token',
    userID: user.id,
  };

  await db.insert(schema.sessions).values(session);

  vi.mocked(createJWT).mockResolvedValueOnce('new-access-token');

  const result = await caller.refreshTokens({
    id: session.id,
    refreshToken: session.refreshToken,
  });

  expect(result).toStrictEqual({
    accessToken: 'new-access-token',
    refreshToken: session.refreshToken,
  });

  expect(createJWT).toHaveBeenCalledOnce();
});

test('it rotates the refresh token if the provided one is older than our short refresh duration', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller, user } = await setupTest({ db });

  const session = {
    createdAt: new Date(Date.now() - consts.SESSION_DURATION_SHORT - 1000),
    expiresAt: new Date(Date.now() + consts.SESSION_DURATION_LONG),
    id: createId(),
    ipAddress: '127.0.0.1',
    refreshToken: 'existing-refresh-token',
    userID: user.id,
  };

  await db.insert(schema.sessions).values(session);

  vi.mocked(createJWT)
    .mockResolvedValueOnce('new-refresh-token')
    .mockResolvedValueOnce('new-access-token');

  const result = await caller.refreshTokens({
    id: session.id,
    refreshToken: session.refreshToken,
  });

  expect(result).toStrictEqual({
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
  });

  expect(createJWT).toHaveBeenCalledTimes(2);
});

test('it throws an error for an expired session', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller, user } = await setupTest({ db });

  const session = {
    createdAt: new Date(),
    expiresAt: new Date(Date.now() - 1000),
    id: createId(),
    ipAddress: '127.0.0.1',
    refreshToken: 'existing-refresh-token',
    userID: user.id,
  };

  await db.insert(schema.sessions).values(session);

  await expect(
    caller.refreshTokens({
      id: session.id,
      refreshToken: session.refreshToken,
    }),
  ).rejects.toMatchObject({
    code: 'BAD_REQUEST',
    message: 'Session expired',
  });

  // verify the session was deleted
  const [deletedSession] = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.id, session.id));

  expect(deletedSession).toBeUndefined();
});

test('it throws an error for an invalid refresh token', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = await setupTest({ db });

  await expect(
    caller.refreshTokens({
      id: createId(),
      refreshToken: 'invalid-token',
    }),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
    message: 'Session not found',
  });
});
