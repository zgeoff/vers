import { createId } from '@paralleldrive/cuid2';
import * as schema from '@vers/postgres-schema';
import { createTestDB } from '@vers/service-test-utils';
import { eq } from 'drizzle-orm';
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

test('it returns an existing verification', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const verification = {
    algorithm: 'sha1',
    charSet: 'hex',
    createdAt: new Date(),
    digits: 6,
    expiresAt: new Date(Date.now() + 1000 * 60 * 5), // 5 minutes from now
    id: createId(),
    period: 300,
    secret: 'ABC123',
    target: 'test@example.com',
    type: 'onboarding',
  } as const;

  await db.insert(schema.verifications).values(verification);

  const result = await caller.getVerification({
    target: 'test@example.com',
    type: 'onboarding',
  });

  expect(result).toStrictEqual({
    id: verification.id,
    target: verification.target,
    type: verification.type,
  });
});

test('it returns null for non-existent verification', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const result = await caller.getVerification({
    target: 'test@example.com',
    type: 'onboarding',
  });

  expect(result).toBeNull();
});

test('it handles and deletes expired verifications', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const verification = {
    algorithm: 'sha1',
    charSet: 'hex',
    createdAt: new Date(),
    digits: 6,
    expiresAt: new Date(Date.now() - 1000), // 1 second ago
    id: createId(),
    period: 300,
    secret: 'ABC123',
    target: 'test@example.com',
    type: 'onboarding',
  } as const;

  await db.insert(schema.verifications).values(verification);

  const result = await caller.getVerification({
    target: 'test@example.com',
    type: 'onboarding',
  });

  expect(result).toBeNull();

  // verify the record was deleted
  const verifications = await db.query.verifications.findMany({
    where: eq(schema.verifications.id, verification.id),
  });

  expect(verifications).toHaveLength(0);
});
