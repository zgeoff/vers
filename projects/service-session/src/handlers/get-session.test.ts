import { createId } from '@paralleldrive/cuid2';
import * as schema from '@vers/postgres-schema';
import { createTestDB, createTestUser } from '@vers/service-test-utils';
import { eq } from 'drizzle-orm';
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

test('it returns the requested session', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller, user } = await setupTest({ db });

  const sessionID = createId();
  const now = new Date();

  await db.insert(schema.sessions).values({
    createdAt: now,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours from now
    id: sessionID,
    ipAddress: '127.0.0.1',
    refreshToken: createId(),
    updatedAt: now,
    userID: user.id,
  });

  const result = await caller.getSession({
    id: sessionID,
  });

  expect(result).toStrictEqual({
    createdAt: expect.any(Date),
    expiresAt: expect.any(Date),
    id: sessionID,
    ipAddress: '127.0.0.1',
    updatedAt: expect.any(Date),
    userID: user.id,
    verified: false,
  });
});

test('it returns null for non-existent session', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = await setupTest({ db });

  const result = await caller.getSession({
    id: 'non-existent-id',
  });

  expect(result).toBeNull();
});

test('it deletes expired sessions and returns null', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller, user } = await setupTest({ db });

  const sessionID = createId();
  const now = new Date();

  await db.insert(schema.sessions).values({
    createdAt: now,
    expiresAt: new Date(now.getTime() - 1000),
    id: sessionID,
    ipAddress: '127.0.0.1',
    refreshToken: createId(),
    updatedAt: now,
    userID: user.id,
    verified: false,
  });

  const result = await caller.getSession({
    id: sessionID,
  });

  expect(result).toBeNull();

  const session = await db.query.sessions.findFirst({
    where: eq(schema.sessions.id, sessionID),
  });

  expect(session).toBeUndefined();
});
