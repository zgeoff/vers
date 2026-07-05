import { drop } from '@mswjs/data';
import { afterEach, expect, test } from 'vitest';
import { db } from '~/mocks/db';
import { sentEmails } from '~/mocks/handlers/trpc/service-email/send-email';
import { createMockGQLContext } from '~/test-utils/create-mock-gql-context';
import { SecureAction } from '~/types';
import { createPendingTransaction } from '~/utils/create-pending-transaction';
import { createTransactionToken } from '~/utils/create-transaction-token';
import { resolve } from './start-change-user-email';

afterEach(() => {
  sentEmails.clear();

  drop(db);
});

test('it creates a verification record and sends an email to the new address', async () => {
  const user = db.user.create({
    email: 'current@test.com',
  });

  const session = db.session.create({
    userID: user.id,
  });

  const ctx = createMockGQLContext({ session, user });

  const args = {
    input: {
      email: 'new@test.com',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    transactionID: expect.any(String),
  });

  const verification = db.verification.findFirst({
    where: {
      target: { equals: 'new@test.com' },
      type: { equals: 'change-email' },
    },
  });

  expect(verification).not.toBeNull();

  const emails = sentEmails.get('new@test.com');

  expect(emails?.length).toBe(1);
  expect(emails?.[0]?.subject).toBe('Verify Your New Email Address');
  expect(emails?.[0]?.html).toContain('verify-otp');
});

test('it follows the usual flow and validates the transaction token when the user requires 2FA', async () => {
  const user = db.user.create({
    email: 'current@test.com',
  });

  const session = db.session.create({
    userID: user.id,
  });

  db.verification.create({
    target: user.email,
    type: '2fa',
  });

  const ctx = createMockGQLContext({ session, user });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ChangeEmail,
      sessionID: session.id,
      target: user.email,
    },
    ctx,
  );

  const transactionToken = await createTransactionToken(
    {
      action: SecureAction.ChangeEmail,
      ipAddress: ctx.ipAddress,
      sessionID: session.id,
      target: user.email,
      transactionID,
    },
    ctx,
  );

  const args = {
    input: {
      email: 'new@test.com',
      transactionToken,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    transactionID: expect.any(String),
  });

  const verification = db.verification.findFirst({
    where: {
      target: { equals: 'new@test.com' },
      type: { equals: 'change-email' },
    },
  });

  expect(verification).not.toBeNull();

  const emails = sentEmails.get('new@test.com');

  expect(emails?.length).toBe(1);
  expect(emails?.[0]?.subject).toBe('Verify Your New Email Address');
  expect(emails?.[0]?.html).toContain('verify-otp');
});

test('it returns an error when the user requires 2FA and the transaction token is invalid', async () => {
  const user = db.user.create({
    email: 'current@test.com',
  });

  db.verification.create({
    target: user.email,
    type: '2fa',
  });

  const ctx = createMockGQLContext({ user });

  const args = {
    input: {
      email: 'new@test.com',
      transactionToken: 'invalid-token',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'An unknown error occurred',
      title: 'Unknown error occurred',
    },
  });

  const verification = db.verification.findFirst({
    where: {
      target: { equals: 'new@test.com' },
      type: { equals: 'change-email' },
    },
  });

  expect(verification).toBeNull();

  const emails = sentEmails.get('new@test.com');

  expect(emails).toBeUndefined();
});

test('it returns an error when the new email is already in use', async () => {
  const user = db.user.create({
    email: 'current@test.com',
  });

  // create another user with the email we want to change to
  db.user.create({
    email: 'new@test.com',
  });

  const session = db.session.create({
    userID: user.id,
  });

  const ctx = createMockGQLContext({ session, user });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ChangeEmail,
      sessionID: session.id,
      target: user.email,
    },
    ctx,
  );

  const transactionToken = await createTransactionToken(
    {
      action: SecureAction.ChangeEmail,
      ipAddress: ctx.ipAddress,
      sessionID: session.id,
      target: user.email,
      transactionID,
    },
    ctx,
  );

  const args = {
    input: {
      email: 'new@test.com',
      transactionToken,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'An unknown error occurred',
      title: 'Unknown error occurred',
    },
  });

  const verification = db.verification.findFirst({
    where: {
      target: { equals: 'new@test.com' },
      type: { equals: 'change-email' },
    },
  });

  expect(verification).toBeNull();

  const emails = sentEmails.get('new@test.com');

  expect(emails).toBeUndefined();
});

test('it returns an error if unauthorized', async () => {
  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: 'new@test.com',
      transactionToken: 'token',
    },
  };

  await expect(resolve({}, args, ctx)).rejects.toThrow('Unauthorized');
});
