import { drop } from '@mswjs/data';
import invariant from 'tiny-invariant';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { sentEmails } from '../../mocks/handlers/trpc/service-email/send-email';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { SecureAction } from '../../types';
import { createPendingTransaction } from '../../utils/create-pending-transaction';
import { createTransactionToken } from '../../utils/create-transaction-token';
import { resolve } from './change-user-password';

afterEach(() => {
  sentEmails.clear();

  drop(db);
});

test('it changes password when user has no 2FA enabled and sends a confirmation email', async () => {
  const user = db.user.create({
    email: 'user@test.com',
    passwordHash: 'old-password',
  });

  const ctx = createMockGQLContext({ user });

  const args = {
    input: {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({ success: true });

  // Verify password was changed
  const updatedUser = db.user.findFirst({
    where: { id: { equals: user.id } },
  });

  expect(updatedUser?.passwordHash).toBe('new-password');

  const emails = sentEmails.get('user@test.com');

  expect(emails?.length).toBe(1);
  expect(emails?.[0]?.html).toContain('Your password has been changed');
});

test('it changes password when user has 2FA enabled and provides valid transaction token', async () => {
  const user = db.user.create({
    email: 'user@test.com',
    passwordHash: 'old-password',
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
      action: SecureAction.ChangePassword,
      sessionID: session.id,
      target: user.email,
    },
    ctx,
  );

  const transactionToken = await createTransactionToken(
    {
      action: SecureAction.ChangePassword,
      ipAddress: ctx.ipAddress,
      sessionID: session.id,
      target: user.email,
      transactionID,
    },
    ctx,
  );

  const args = {
    input: {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      transactionToken,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({ success: true });

  // Verify password was changed
  const updatedUser = db.user.findFirst({
    where: { id: { equals: user.id } },
  });

  expect(updatedUser?.passwordHash).toBe('new-password');
});

test('it returns an error when user has 2FA enabled but no transaction token', async () => {
  const user = db.user.create({
    email: 'user@test.com',
    passwordHash: 'old-password-hash',
  });

  db.verification.create({
    target: user.email,
    type: '2fa',
  });

  const ctx = createMockGQLContext({ user });

  const args = {
    input: {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'Wrong password',
      title: 'Invalid password',
    },
  });

  // Verify password was not changed
  const updatedUser = db.user.findFirst({
    where: { id: { equals: user.id } },
  });

  expect(updatedUser?.passwordHash).toBe('old-password-hash');
});

test('it returns an error when user has 2FA enabled but transaction token is invalid', async () => {
  const user = db.user.create({
    email: 'user@test.com',
    passwordHash: 'old-password-hash',
  });

  db.verification.create({
    target: user.email,
    type: '2fa',
  });

  const ctx = createMockGQLContext({ user });

  const args = {
    input: {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      transactionToken: 'invalid-token',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'Wrong password',
      title: 'Invalid password',
    },
  });

  // Verify password was not changed
  const updatedUser = db.user.findFirst({
    where: { id: { equals: user.id } },
  });

  expect(updatedUser?.passwordHash).toBe('old-password-hash');
});

test('it returns an error when current password is invalid', async () => {
  const user = db.user.create({
    email: 'user@test.com',
    passwordHash: 'old-password-hash',
  });

  const ctx = createMockGQLContext({ user });

  invariant(ctx.session, 'session is required');

  const args = {
    input: {
      currentPassword: 'wrong-password',
      newPassword: 'new-password',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'Wrong password',
      title: 'Invalid password',
    },
  });

  // Verify password was not changed
  const updatedUser = db.user.findFirst({
    where: { id: { equals: user.id } },
  });

  expect(updatedUser?.passwordHash).toBe('old-password-hash');
});

test('it returns an error if unauthorized', async () => {
  const ctx = createMockGQLContext({});

  const args = {
    input: {
      currentPassword: 'current-password',
      newPassword: 'new-password',
    },
  };

  await expect(resolve({}, args, ctx)).rejects.toThrow('Unauthorized');
});
