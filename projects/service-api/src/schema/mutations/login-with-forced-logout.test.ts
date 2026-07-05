import { drop } from '@mswjs/data';
import { afterEach, expect, test } from 'vitest';
import { db } from '~/mocks/db';
import { createMockGQLContext } from '~/test-utils/create-mock-gql-context';
import { SecureAction } from '~/types';
import { createPendingTransaction } from '~/utils/create-pending-transaction';
import { createTransactionToken } from '~/utils/create-transaction-token';
import { resolve } from './login-with-forced-logout';

afterEach(() => {
  drop(db);
});

test('it verifies a session and returns tokens', async () => {
  const user = db.user.create({
    email: 'user@test.com',
    passwordHash: 'password123',
  });

  const session = db.session.create({
    userID: user.id,
  });

  const ctx = createMockGQLContext({ session });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ForceLogout,
      sessionID: session.id,
      target: 'user@test.com',
    },
    ctx,
  );

  const transactionToken = await createTransactionToken(
    {
      action: SecureAction.ForceLogout,
      ipAddress: ctx.ipAddress,
      sessionID: session.id,
      target: 'user@test.com',
      transactionID,
    },
    ctx,
  );

  const args = {
    input: {
      target: user.email,
      transactionToken,
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
      refreshToken: expect.any(String),
      updatedAt: expect.any(Date),
      userID: user.id,
      verified: false,
    },
  });
});

test('it removes all previous sessions when a user is logged in', async () => {
  const user = db.user.create({
    email: 'user@test.com',
    passwordHash: 'password123',
  });

  const session = db.session.create({
    userID: user.id,
  });

  // create 3 other sessions for our user
  Array.from({ length: 3 }).forEach(() => {
    db.session.create({
      userID: user.id,
    });
  });

  const ctx = createMockGQLContext({ session });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ForceLogout,
      sessionID: session.id,
      target: 'user@test.com',
    },
    ctx,
  );

  const transactionToken = await createTransactionToken(
    {
      action: SecureAction.ForceLogout,
      ipAddress: ctx.ipAddress,
      sessionID: session.id,
      target: 'user@test.com',
      transactionID,
    },
    ctx,
  );

  const args = {
    input: {
      target: user.email,
      transactionToken,
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
      refreshToken: expect.any(String),
      updatedAt: expect.any(Date),
      userID: user.id,
      verified: false,
    },
  });

  const sessions = db.session.findMany({
    where: {
      userID: { equals: user.id },
    },
  });

  expect(sessions).toHaveLength(1);
  expect(sessions[0]?.id).toBe(session.id);
});

test('it returns an error if the transaction token is invalid', async () => {
  const user = db.user.create({
    email: 'user@test.com',
  });

  const session = db.session.create({
    userID: user.id,
  });

  const ctx = createMockGQLContext({ session, user });

  const args = {
    input: {
      target: user.email,
      transactionToken: 'invalid',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'An unknown error occurred',
      title: 'Unknown error occurred',
    },
  });
});

test('it returns an error if the user is not found', async () => {
  const session = db.session.create({
    userID: 'user@test.com',
  });

  const ctx = createMockGQLContext({ session });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ForceLogout,
      sessionID: session.id,
      target: 'user@test.com',
    },
    ctx,
  );

  const transactionToken = await createTransactionToken(
    {
      action: SecureAction.ForceLogout,
      ipAddress: ctx.ipAddress,
      sessionID: session.id,
      target: 'user@test.com',
      transactionID,
    },
    ctx,
  );

  const args = {
    input: {
      target: 'user@test.com',
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
});
