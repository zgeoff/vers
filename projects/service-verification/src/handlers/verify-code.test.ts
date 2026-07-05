import { createId } from '@paralleldrive/cuid2';
import * as schema from '@vers/postgres-schema';
import { createTestDB } from '@vers/service-test-utils';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import invariant from 'tiny-invariant';
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

test('it verifies a valid code', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const createResult = await caller.createVerification({
    period: 300,
    target: 'test@example.com',
    type: 'onboarding',
  });

  const verifyResult = await caller.verifyCode({
    code: createResult.otp,
    target: 'test@example.com',
    type: 'onboarding',
  });

  expect(verifyResult).toStrictEqual({
    id: expect.any(String),
    target: 'test@example.com',
    type: 'onboarding',
  });

  invariant(verifyResult);

  // verify the record was deleted
  const verifications = await db.query.verifications.findMany({
    where: eq(schema.verifications.id, verifyResult.id),
  });

  expect(verifications).toHaveLength(0);
});

test('it rejects invalid code', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  await expect(
    caller.verifyCode({
      code: 'INVALID',
      target: 'test@example.com',
      type: 'onboarding',
    }),
  ).rejects.toMatchObject({
    code: 'BAD_REQUEST',
    message: 'Invalid verification code',
  });
});

test('it rejects expired codes', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const verification = {
    algorithm: 'sha1',
    charSet: 'hex',
    createdAt: new Date(),
    digits: 6,
    expiresAt: new Date(Date.now() - 1000),
    id: createId(),
    period: 300,
    secret: 'ABC123',
    target: 'test@example.com',
    type: 'onboarding',
  } as const;

  await db.insert(schema.verifications).values(verification);

  await expect(
    caller.verifyCode({
      code: verification.secret,
      target: 'test@example.com',
      type: 'onboarding',
    }),
  ).rejects.toMatchObject({
    code: 'BAD_REQUEST',
    message: 'Verification code has expired',
  });

  // verify the record was deleted
  const verifications = await db.query.verifications.findMany({
    where: eq(schema.verifications.id, verification.id),
  });

  expect(verifications).toHaveLength(0);
});

test('it does not delete a 2FA setup verification', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const createResult = await caller.createVerification({
    target: 'test@example.com',
    type: '2fa-setup',
  });

  const verifyResult = await caller.verifyCode({
    code: createResult.otp,
    target: 'test@example.com',
    type: '2fa-setup',
  });

  expect(verifyResult).toStrictEqual({
    id: createResult.id,
    target: 'test@example.com',
    type: '2fa-setup',
  });

  const verification = await db.query.verifications.findFirst({
    where: eq(schema.verifications.id, createResult.id),
  });

  expect(verification).toBeDefined();
});

test('it does not delete a 2FA verification', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const createResult = await caller.createVerification({
    target: 'test@example.com',
    type: '2fa',
  });

  const verifyResult = await caller.verifyCode({
    code: createResult.otp,
    target: 'test@example.com',
    type: '2fa',
  });

  expect(verifyResult).toStrictEqual({
    id: createResult.id,
    target: 'test@example.com',
    type: '2fa',
  });

  const verification = await db.query.verifications.findFirst({
    where: eq(schema.verifications.id, createResult.id),
  });

  expect(verification).toBeDefined();
});
