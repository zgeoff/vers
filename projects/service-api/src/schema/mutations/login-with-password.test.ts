import { drop } from '@mswjs/data';
import invariant from 'tiny-invariant';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { SecureAction } from '../../types';
import { pendingTransactionCache } from '../../utils/pending-transaction-cache';
import { resolve } from './login-with-password';

afterEach(() => {
  drop(db);
});

test('it returns tokens when credentials are valid, 2FA is not enabled, and no active sessions exist', async () => {
  const user = db.user.create({
    email: 'user@test.com',
    passwordHash: 'password123',
  });

  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: user.email,
      password: 'password123',
      rememberMe: true,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    accessToken: expect.any(String),
    refreshToken: expect.any(String),
    session: {
      createdAt: expect.any(Date),
      expiresAt: expect.any(Date),
      id: expect.any(String),
      ipAddress: ctx.ipAddress,
      refreshToken: null,
      updatedAt: expect.any(Date),
      userID: user.id,
      verified: false,
    },
  });
});

test('it returns a two factor login payload when 2FA is enabled', async () => {
  const user = db.user.create({
    email: 'user@test.com',
    passwordHash: 'password123',
  });

  db.verification.create({
    target: user.email,
    type: '2fa',
  });

  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: user.email,
      password: 'password123',
      rememberMe: true,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    sessionID: expect.any(String),
    transactionID: expect.any(String),
  });

  invariant('transactionID' in result);

  const pendingTransaction = pendingTransactionCache.get(result.transactionID);

  expect(pendingTransaction).toStrictEqual({
    action: SecureAction.TwoFactorAuth,
    attempts: 0,
    ipAddress: ctx.ipAddress,
    sessionID: result.sessionID,
    target: user.email,
  });
});

test('it returns a force logout payload when 2FA is not enabled, but there are active sessions', async () => {
  const user = db.user.create({
    email: 'user@test.com',
    passwordHash: 'password123',
  });

  db.session.create({
    ipAddress: '127.0.0.1',
    userID: user.id,
  });

  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: user.email,
      password: 'password123',
      rememberMe: true,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    sessionID: expect.any(String),
    transactionToken: expect.any(String),
  });
});

test('it returns an error when the user does not exist', async () => {
  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: 'nonexistent@test.com',
      password: 'password123',
      rememberMe: true,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'Wrong email or password',
      title: 'Invalid credentials',
    },
  });
});

test('it returns an error when the password is incorrect', async () => {
  const user = db.user.create({
    email: 'user@test.com',
    passwordHash: 'password123',
  });

  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: user.email,
      password: 'wrongpassword',
      rememberMe: true,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'Wrong email or password',
      title: 'Invalid credentials',
    },
  });
});
