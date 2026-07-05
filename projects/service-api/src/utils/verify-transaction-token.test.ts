import { drop } from '@mswjs/data';
import { afterEach, expect, test, vi } from 'vitest';
import { db } from '../mocks/db';
import { createMockGQLContext } from '../test-utils/create-mock-gql-context';
import { SecureAction } from '../types';
import { createPendingTransaction } from './create-pending-transaction';
import { createTransactionToken } from './create-transaction-token';
import { verifyTransactionToken } from './verify-transaction-token';

afterEach(() => {
  vi.useRealTimers();

  drop(db);
});

test('it returns true when no token is provided', async () => {
  const ctx = createMockGQLContext({});

  const data = {
    action: SecureAction.Onboarding,
    target: 'user_123',
    token: null,
  };

  const result = await verifyTransactionToken(data, ctx);

  expect(result).toBeNull();
});

test('it validates a token with matching action, target, and IP', async () => {
  const ctx = createMockGQLContext({ ipAddress: '127.0.0.1' });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.Onboarding,
      sessionID: null,
      target: 'user_123',
    },
    ctx,
  );

  const tokenParts = {
    action: SecureAction.Onboarding,
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'user_123',
    transactionID,
  };

  const token = await createTransactionToken(tokenParts, ctx);

  const result = await verifyTransactionToken(
    {
      action: SecureAction.Onboarding,
      target: 'user_123',
      token,
    },
    ctx,
  );

  expect(result).toStrictEqual({
    action: 'Onboarding',
    amr: ['otp'],
    auth_time: expect.any(Number),
    ip_address: '127.0.0.1',
    jti: expect.any(String),
    mfa_verified: true,
    session_id: null,
    sub: 'user_123',
    transaction_id: transactionID,
  });
});

test('it returns null when action does not match', async () => {
  const ctx = createMockGQLContext({ ipAddress: '127.0.0.1' });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.Onboarding,
      sessionID: null,
      target: 'user_123',
    },
    ctx,
  );

  const data = {
    action: SecureAction.Onboarding,
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'user_123',
    transactionID,
  };

  const token = await createTransactionToken(data, ctx);

  const result = await verifyTransactionToken(
    {
      action: SecureAction.ChangeEmail,
      target: 'user_123',
      token,
    },
    ctx,
  );

  expect(result).toBeNull();
});

test('it returns null when IP address does not match', async () => {
  const pendingCtx = createMockGQLContext({
    ipAddress: '192.168.1.1',
    requestID: 'test',
  });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.Onboarding,
      sessionID: null,
      target: 'user_123',
    },
    pendingCtx,
  );

  const data = {
    action: SecureAction.Onboarding,
    ipAddress: '192.168.1.1',
    sessionID: null,
    target: 'user_123',
    transactionID,
  };

  const token = await createTransactionToken(data, pendingCtx);

  const otherCtx = createMockGQLContext({
    ipAddress: '127.0.0.1',
    requestID: 'test',
  });

  const result = await verifyTransactionToken(
    {
      action: SecureAction.Onboarding,
      target: 'user_123',
      token,
    },
    otherCtx,
  );

  expect(result).toBeNull();
});

test('it returns null when token is reused', async () => {
  const ctx = createMockGQLContext({ ipAddress: '127.0.0.1' });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.Onboarding,
      sessionID: null,
      target: 'user_123',
    },
    ctx,
  );

  const data = {
    action: SecureAction.Onboarding,
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'user_123',
    transactionID,
  };

  const token = await createTransactionToken(data, ctx);

  // First use should succeed
  const firstResult = await verifyTransactionToken(
    {
      action: SecureAction.Onboarding,
      target: 'user_123',
      token,
    },
    ctx,
  );

  expect(firstResult).toStrictEqual({
    action: 'Onboarding',
    amr: ['otp'],
    auth_time: expect.any(Number),
    ip_address: '127.0.0.1',
    jti: expect.any(String),
    mfa_verified: true,
    session_id: null,
    sub: 'user_123',
    transaction_id: transactionID,
  });

  // Second use should fail
  const secondResult = await verifyTransactionToken(
    {
      action: SecureAction.Onboarding,
      target: 'user_123',
      token,
    },
    ctx,
  );

  expect(secondResult).toBeNull();
});

test('it validates session for actions that require it', async () => {
  const session = db.session.create({
    userID: 'user_123',
  });

  const ctx = createMockGQLContext({ session });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ChangeEmail,
      sessionID: session.id,
      target: 'user_123',
    },
    ctx,
  );

  const data = {
    action: SecureAction.ChangeEmail,
    ipAddress: '127.0.0.1',
    sessionID: session.id,
    target: 'user_123',
    transactionID,
  };

  const token = await createTransactionToken(data, ctx);

  const result = await verifyTransactionToken(
    {
      action: SecureAction.ChangeEmail,
      target: 'user_123',
      token,
    },
    ctx,
  );

  expect(result).toStrictEqual({
    action: 'ChangeEmail',
    amr: ['otp'],
    auth_time: expect.any(Number),
    ip_address: '127.0.0.1',
    jti: expect.any(String),
    mfa_verified: true,
    session_id: session.id,
    sub: 'user_123',
    transaction_id: transactionID,
  });
});

test('it returns null when session is required but not found', async () => {
  const ctx = createMockGQLContext({ ipAddress: '127.0.0.1' });

  // we need to create the session temporarily for our token to be successfully created
  const session = db.session.create({
    ipAddress: '127.0.0.1',
    userID: 'user_123',
  });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ChangeEmail,
      sessionID: session.id,
      target: 'user_123',
    },
    ctx,
  );

  const data = {
    action: SecureAction.ChangeEmail,
    ipAddress: '127.0.0.1',
    sessionID: session.id,
    target: 'user_123',
    transactionID,
  };

  const token = await createTransactionToken(data, ctx);

  // delete the session prior to verifying the token
  db.session.delete({
    where: {
      id: { equals: data.sessionID },
    },
  });

  const result = await verifyTransactionToken(
    {
      action: SecureAction.ChangeEmail,
      target: 'user_123',
      token,
    },
    ctx,
  );

  expect(result).toBeNull();
});

test('it returns null when session ID does not match', async () => {
  const pendingTransactionSession = db.session.create({
    ipAddress: '127.0.0.1',
    userID: 'user_123',
  });

  const pendingTransactionContext = createMockGQLContext({
    ipAddress: '127.0.0.1',
    session: pendingTransactionSession,
  });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ChangeEmail,
      sessionID: pendingTransactionSession.id,
      target: 'user_123',
    },
    pendingTransactionContext,
  );

  const verifySession = db.session.create({
    ipAddress: '127.0.0.1',
    userID: 'user_123',
  });

  const verifySessionContext = createMockGQLContext({
    ipAddress: '127.0.0.1',
    session: verifySession,
  });

  const data = {
    action: SecureAction.ChangeEmail,
    ipAddress: '127.0.0.1',
    sessionID: pendingTransactionSession.id,
    target: 'user_123',
    transactionID,
  };

  const token = await createTransactionToken(data, pendingTransactionContext);

  const result = await verifyTransactionToken(
    {
      action: SecureAction.ChangeEmail,
      target: 'user_123',
      token,
    },
    verifySessionContext,
  );

  expect(result).toBeNull();
});

test('it returns null when token is expired', async () => {
  vi.useFakeTimers();

  const ctx = createMockGQLContext({ ipAddress: '127.0.0.1' });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.TwoFactorAuth,
      sessionID: null,
      target: 'user_123',
    },
    ctx,
  );

  const data = {
    action: SecureAction.TwoFactorAuth,
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'user_123',
    transactionID,
  };

  const token = await createTransactionToken(data, ctx);

  const twoMinutesInMS = 2 * 60 * 1000;

  // Wait for token to expire (2 minutes + buffer)
  vi.setSystemTime(Date.now() + twoMinutesInMS + 1000);

  const result = await verifyTransactionToken(
    {
      action: SecureAction.TwoFactorAuth,
      target: 'user_123',
      token,
    },
    ctx,
  );

  expect(result).toBeNull();
});
