import { drop } from '@mswjs/data';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { SecureAction } from '../../types';
import { createPendingTransaction } from '../../utils/create-pending-transaction';
import { createTransactionToken } from '../../utils/create-transaction-token';
import { resolve } from './finish-login-with-2fa';

afterEach(() => {
  drop(db);
});

test('it returns tokens when the transaction token is valid and there are no previous sessions', async () => {
  const user = db.user.create({
    email: 'user@test.com',
  });

  const session = db.session.create({
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    userID: user.id,
    verified: false,
  });

  const ctx = createMockGQLContext({ session });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.TwoFactorAuth,
      sessionID: session.id,
      target: 'user@test.com',
    },
    ctx,
  );

  const verification = db.verification.create({
    target: 'user@test.com',
    type: '2fa',
  });

  const transactionToken = await createTransactionToken(
    {
      action: SecureAction.TwoFactorAuth,
      ipAddress: ctx.ipAddress,
      sessionID: session.id,
      target: verification.target,
      transactionID,
    },
    ctx,
  );

  const args = {
    input: {
      rememberMe: true,
      target: verification.target,
      transactionToken,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    accessToken: expect.any(String),
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    refreshToken: expect.any(String),
    session: {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
      createdAt: expect.any(Date),
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
      expiresAt: expect.any(Date),
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
      id: expect.any(String),
      ipAddress: ctx.ipAddress,
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
      refreshToken: expect.any(String),
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
      updatedAt: expect.any(Date),
      userID: user.id,
      verified: false,
    },
  });
});

test('it returns a force logout payload when the transaction token is valid and there are previous sessions', async () => {
  const user = db.user.create({
    email: 'user@test.com',
  });

  // initial session we'll consider the previous session
  db.session.create({
    userID: user.id,
  });

  const session = db.session.create({
    userID: user.id,
  });

  const ctx = createMockGQLContext({ session });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.TwoFactorAuth,
      sessionID: session.id,
      target: 'user@test.com',
    },
    ctx,
  );

  const verification = db.verification.create({
    target: 'user@test.com',
    type: '2fa',
  });

  const transactionToken = await createTransactionToken(
    {
      action: SecureAction.TwoFactorAuth,
      ipAddress: ctx.ipAddress,
      sessionID: session.id,
      target: verification.target,
      transactionID,
    },
    ctx,
  );

  const args = {
    input: {
      rememberMe: true,
      target: verification.target,
      transactionToken,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    sessionID: session.id,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    transactionToken: expect.any(String),
  });
});

test('it returns an error when 2FA is not enabled', async () => {
  const ctx = createMockGQLContext({});

  const user = db.user.create({
    email: 'user@test.com',
  });

  const session = db.session.create({
    ipAddress: ctx.ipAddress,
    userID: user.id,
  });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.TwoFactorAuth,
      sessionID: session.id,
      target: 'user@test.com',
    },
    ctx,
  );

  const transactionToken = await createTransactionToken(
    {
      action: SecureAction.TwoFactorAuth,
      ipAddress: ctx.ipAddress,
      sessionID: session.id,
      target: 'user@test.com',
      transactionID,
    },
    ctx,
  );

  const args = {
    input: {
      rememberMe: true,
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

test('it returns an error when the transaction token is invalid', async () => {
  const user = db.user.create({
    email: 'user@test.com',
  });

  db.verification.create({
    target: user.email,
    type: '2fa',
  });

  const ctx = createMockGQLContext({});

  const args = {
    input: {
      rememberMe: true,
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
