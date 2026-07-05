import * as schema from '@vers/postgres-schema';
import { createTestDB } from '@vers/service-test-utils';
import { and, eq } from 'drizzle-orm';
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

test('creates a verification code and stores a record of it', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const result = await caller.createVerification({
    period: 5 * 60, // 5 minutes
    target: 'test@example.com',
    type: 'onboarding',
  });

  expect(result).toStrictEqual({
    id: expect.any(String),
    otp: expect.any(String),
    target: 'test@example.com',
    type: 'onboarding',
  });

  const verification = await db.query.verifications.findFirst({
    where: and(
      eq(schema.verifications.target, 'test@example.com'),
      eq(schema.verifications.type, 'onboarding'),
    ),
  });

  expect(verification).toStrictEqual({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
    createdAt: expect.any(Date),
    digits: 6,
    expiresAt: null,
    id: expect.any(String),
    period: 300,
    secret: expect.any(String),
    target: 'test@example.com',
    type: 'onboarding',
  });
});

test('it uses a simple charset for 2FA verification codes', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const result = await caller.createVerification({
    target: 'test@example.com',
    type: '2fa',
  });

  expect(result).toStrictEqual({
    id: expect.any(String),
    otp: expect.any(String),
    target: 'test@example.com',
    type: '2fa',
  });

  const verification = await db.query.verifications.findFirst({
    where: and(
      eq(schema.verifications.target, 'test@example.com'),
      eq(schema.verifications.type, '2fa'),
    ),
  });

  expect(verification).toStrictEqual({
    algorithm: 'SHA-256',
    charSet: '0123456789',
    createdAt: expect.any(Date),
    digits: 6,
    expiresAt: null,
    id: expect.any(String),
    period: 30,
    secret: expect.any(String),
    target: 'test@example.com',
    type: '2fa',
  });
});

test('it uses a simple charset for 2FA setup verification codes', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const result = await caller.createVerification({
    target: 'test@example.com',
    type: '2fa-setup',
  });

  expect(result).toStrictEqual({
    id: expect.any(String),
    otp: expect.any(String),
    target: 'test@example.com',
    type: '2fa-setup',
  });

  const verification = await db.query.verifications.findFirst({
    where: and(
      eq(schema.verifications.target, 'test@example.com'),
      eq(schema.verifications.type, '2fa-setup'),
    ),
  });

  expect(verification).toStrictEqual({
    algorithm: 'SHA-256',
    charSet: '0123456789',
    createdAt: expect.any(Date),
    digits: 6,
    expiresAt: null,
    id: expect.any(String),
    period: 30,
    secret: expect.any(String),
    target: 'test@example.com',
    type: '2fa-setup',
  });
});

test('replaces existing verification for same target and type', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  await caller.createVerification({
    period: 300,
    target: 'test@example.com',
    type: 'onboarding',
  });

  const result = await caller.createVerification({
    period: 300,
    target: 'test@example.com',
    type: 'onboarding',
  });

  expect(result).toStrictEqual({
    id: expect.any(String),
    otp: expect.any(String),
    target: 'test@example.com',
    type: 'onboarding',
  });

  const verifications = await db.query.verifications.findMany({
    where: and(
      eq(schema.verifications.type, 'onboarding'),
      eq(schema.verifications.target, 'test@example.com'),
    ),
  });

  expect(verifications).toHaveLength(1);
});

test('creates a verification with explicit expiry time', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const now = Date.now();

  const result = await caller.createVerification({
    expiresAt: new Date(now + 10 * 60 * 1000),
    target: 'test@example.com',
    type: 'onboarding',
  });

  expect(result).toStrictEqual({
    id: expect.any(String),
    otp: expect.any(String),
    target: 'test@example.com',
    type: 'onboarding',
  });

  const verification = await db.query.verifications.findFirst({
    where: and(
      eq(schema.verifications.target, 'test@example.com'),
      eq(schema.verifications.type, 'onboarding'),
    ),
  });

  expect(verification).toBeDefined();
  expect(verification).toStrictEqual({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
    createdAt: expect.any(Date),
    digits: 6,
    expiresAt: new Date(now + 10 * 60 * 1000),
    id: expect.any(String),
    period: 30,
    secret: expect.any(String),
    target: 'test@example.com',
    type: 'onboarding',
  });
});
