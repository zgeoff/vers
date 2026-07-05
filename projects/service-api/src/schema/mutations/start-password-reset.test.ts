import { drop } from '@mswjs/data';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { sentEmails } from '../../mocks/handlers/trpc/service-email/send-email';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { resolve } from './start-password-reset';

afterEach(() => {
  sentEmails.clear();

  drop(db);
});

test('it sets a reset token, sends an email then returns success for an existing user', async () => {
  db.user.create({
    email: 'test@example.com',
    passwordHash: 'hashed_password',
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
  });

  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: 'test@example.com',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({ success: true });

  const user = db.user.findFirst({
    where: {
      email: { equals: 'test@example.com' },
    },
  });

  expect(user?.passwordResetToken).toBeDefined();
  expect(user?.passwordResetTokenExpiresAt).toBeDefined();

  const emails = sentEmails.get('test@example.com');

  expect(emails?.length).toBe(1);

  expect(emails?.[0]?.html).toContain(
    `http://localhost:4000/reset-password?token=${user?.passwordResetToken}&amp;email=test%40example.com`,
  );
});

test('it directs the user to verify an OTP when 2FA is enabled', async () => {
  db.user.create({
    email: 'test@example.com',
    passwordHash: 'hashed_password',
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
  });

  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: 'test@example.com',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    transactionID: expect.any(String),
  });

  const emails = sentEmails.get('test@example.com');

  expect(emails?.length).toBe(1);
  expect(emails?.[0]?.html).toContain('http://localhost:4000/verify-otp?type=RESET_PASSWORD');
});

test('it returns success for non-existent user (to prevent user enumeration)', async () => {
  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: 'nonexistent@example.com',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    success: true,
  });

  const verification = db.verification.findFirst({
    where: {
      target: { equals: 'nonexistent@example.com' },
    },
  });

  expect(verification).toBeNull();
});
