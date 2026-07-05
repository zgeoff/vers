import { drop } from '@mswjs/data';
import { TRPCError } from '@trpc/server';
import { afterEach, expect, test, vi } from 'vitest';
import { db } from '~/mocks/db';
import { trpc } from '~/mocks/handlers/trpc/service-user/trpc';
import { server } from '~/mocks/node';
import { createMockGQLContext } from '~/test-utils/create-mock-gql-context';
import { SecureAction } from '~/types';
import { createPendingTransaction } from '~/utils/create-pending-transaction';
import { createTransactionToken } from '~/utils/create-transaction-token';
import { resolve } from './finish-password-reset';

afterEach(() => {
  drop(db);

  server.resetHandlers();
});

test('it updates the password and removes the password reset token', async () => {
  const user = db.user.create({
    email: 'test@example.com',
    passwordHash: 'old_password_hash',
    passwordResetToken: '123456',
    passwordResetTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 10),
  });

  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: 'test@example.com',
      password: 'newpassword123',
      resetToken: '123456',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    success: true,
  });

  const updatedUser = db.user.findFirst({
    where: {
      id: { equals: user.id },
    },
  });

  expect(updatedUser?.passwordHash).toBe('newpassword123');
  expect(updatedUser?.passwordResetToken).toBeNull();
  expect(updatedUser?.passwordResetTokenExpiresAt).toBeNull();
});

test('it returns a success response for non-existent user (to avoid user enumeration)', async () => {
  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: 'nonexistent@example.com',
      password: 'newpassword123',
      resetToken: '123456',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    success: true,
  });
});

test('it returns success but does not change the password if 2fa is required and the transaction token is invalid', async () => {
  const user = db.user.create({
    email: 'test@example.com',
    passwordHash: 'old_password_hash',
    passwordResetToken: '123456',
    passwordResetTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 10),
  });

  db.verification.create({
    target: user.email,
    type: '2fa',
  });

  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: 'test@example.com',
      password: 'newpassword123',
      resetToken: '123456',
      transactionToken: 'invalid-token',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    success: true,
  });

  const updatedUser = db.user.findFirst({
    where: {
      id: { equals: user.id },
    },
  });

  // Password should not be changed
  expect(updatedUser?.passwordHash).toBe('old_password_hash');
  expect(updatedUser?.passwordResetToken).toBe('123456');
  expect(updatedUser?.passwordResetTokenExpiresAt).toBeDefined();
});

test('it updates the password when 2fa is required and the transaction token is valid', async () => {
  const user = db.user.create({
    email: 'test@example.com',
    passwordHash: 'old_password_hash',
    passwordResetToken: '123456',
    passwordResetTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 10),
  });

  db.verification.create({
    target: user.email,
    type: '2fa',
  });

  const ctx = createMockGQLContext({});

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ResetPassword,
      sessionID: null,
      target: user.email,
    },
    ctx,
  );

  const transactionToken = await createTransactionToken(
    {
      action: SecureAction.ResetPassword,
      ipAddress: ctx.ipAddress,
      sessionID: null,
      target: user.email,
      transactionID,
    },
    ctx,
  );

  const args = {
    input: {
      email: 'test@example.com',
      password: 'newpassword123',
      resetToken: '123456',
      transactionToken,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    success: true,
  });

  const updatedUser = db.user.findFirst({
    where: {
      id: { equals: user.id },
    },
  });

  expect(updatedUser?.passwordHash).toBe('newpassword123');
  expect(updatedUser?.passwordResetToken).toBeNull();
  expect(updatedUser?.passwordResetTokenExpiresAt).toBeNull();
});

test('it returns a success response for any errors returned from the change password endpoint', async () => {
  db.user.create({
    email: 'test@example.com',
    passwordHash: 'old_password_hash',
    passwordResetToken: '123456',
    passwordResetTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 10),
  });

  const ctx = createMockGQLContext({});

  const resetPasswordHandler = vi.fn<() => never>(() => {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to change password',
    });
  });

  server.use(trpc.resetPassword.mutation(resetPasswordHandler));

  const args = {
    input: {
      email: 'test@example.com',
      password: 'newpassword123',
      resetToken: '123456',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(resetPasswordHandler).toHaveBeenCalledOnce();
  expect(result).toStrictEqual({ success: true });
});
