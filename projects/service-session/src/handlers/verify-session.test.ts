import * as schema from '@vers/postgres-schema';
import { createTestDB, createTestUser } from '@vers/service-test-utils';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { afterEach, expect, test, vi } from 'vitest';
import { router } from '../router';
import { t } from '../t';
import { createJWT } from '../utils/create-jwt';

vi.mock(import('../utils/create-jwt'));

const createCaller = t.createCallerFactory(router);

interface TestConfig {
  db: PostgresJsDatabase<typeof schema>;
}

async function setupTest(config: TestConfig) {
  const caller = createCaller({ db: config.db });

  const user = await createTestUser(config.db);

  return { caller, user };
}

afterEach(() => {
  vi.clearAllMocks();
});

test('it flags a session as verified and returns new tokens', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller, user } = await setupTest({ db });

  vi.mocked(createJWT)
    .mockResolvedValueOnce('mock-refresh-token')
    .mockResolvedValueOnce('mock-access-token');

  const now = Date.now();
  const expiresAt = new Date(now + 1000 * 60 * 60);

  const session = {
    createdAt: new Date(),
    expiresAt,
    id: 'test_session_id',
    ipAddress: '127.0.0.1',
    refreshToken: null,
    updatedAt: new Date(),
    userID: user.id,
    verified: false,
  };

  await db.insert(schema.sessions).values(session);

  const result = await caller.verifySession({
    id: session.id,
  });

  expect(result).toStrictEqual({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  });

  const [refreshTokenCall] = vi.mocked(createJWT).mock.calls[0]!;
  const [accessTokenCall] = vi.mocked(createJWT).mock.calls[1]!;

  const refreshTokenExpires = refreshTokenCall.expiresAt.getTime();
  const accessTokenExpires = accessTokenCall.expiresAt.getTime();

  expect(refreshTokenExpires).toBe(expiresAt.getTime());

  // measured against wall clock, so allow scheduler jitter on loaded CI runners
  expect(accessTokenExpires - now).toBeWithin(15 * 60 * 1000, 15 * 60 * 1000 + 5000);
});

test("it throws an error if the session doesn't exist", async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = await setupTest({ db });

  await expect(
    caller.verifySession({
      id: 'invalid-session-id',
    }),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
    message: 'Session not found',
  });
});

test('it throws an error if the session is already verified', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = await setupTest({ db });

  await expect(
    caller.verifySession({
      id: 'invalid-session-id',
    }),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
    message: 'Session not found',
  });
});
