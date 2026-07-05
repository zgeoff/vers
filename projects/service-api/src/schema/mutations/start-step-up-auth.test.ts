import { drop } from '@mswjs/data';
import invariant from 'tiny-invariant';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { SecureAction } from '../../types';
import { pendingTransactionCache } from '../../utils/pending-transaction-cache';
import { StepUpAction } from '../types/step-up-action';
import { resolve } from './start-step-up-auth';

afterEach(() => {
  drop(db);

  pendingTransactionCache.clear();
});

test('it creates a pending transaction for CHANGE_EMAIL when user has 2FA enabled', async () => {
  const user = db.user.create({
    email: 'user@test.com',
  });

  db.verification.create({
    target: user.email,
    type: '2fa',
  });

  const session = db.session.create({
    userID: user.id,
  });

  const ctx = createMockGQLContext({
    session,
    user,
  });

  const args = {
    input: {
      action: StepUpAction.CHANGE_EMAIL,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    transactionID: expect.any(String),
  });

  invariant('transactionID' in result);

  const pendingTransaction = pendingTransactionCache.get(result.transactionID);

  expect(pendingTransaction).toStrictEqual({
    action: SecureAction.ChangeEmail,
    attempts: 0,
    ipAddress: ctx.ipAddress,
    sessionID: ctx.session?.id,
    target: user.email,
  });
});

test('it creates a pending transaction for CHANGE_PASSWORD when user has 2FA enabled', async () => {
  const user = db.user.create({
    email: 'user@test.com',
  });

  db.verification.create({
    target: user.email,
    type: '2fa',
  });

  const session = db.session.create({
    userID: user.id,
  });

  const ctx = createMockGQLContext({
    session,
    user,
  });

  const args = {
    input: {
      action: StepUpAction.CHANGE_PASSWORD,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    transactionID: expect.any(String),
  });

  invariant('transactionID' in result);

  const pendingTransaction = pendingTransactionCache.get(result.transactionID);

  expect(pendingTransaction).toStrictEqual({
    action: SecureAction.ChangePassword,
    attempts: 0,
    ipAddress: ctx.ipAddress,
    sessionID: ctx.session?.id,
    target: user.email,
  });
});

test('it creates a pending transaction for DISABLE_2FA when user has 2FA enabled', async () => {
  const user = db.user.create({
    email: 'user@test.com',
  });

  db.verification.create({
    target: user.email,
    type: '2fa',
  });

  const session = db.session.create({
    userID: user.id,
  });

  const ctx = createMockGQLContext({ session, user });

  const args = {
    input: {
      action: StepUpAction.DISABLE_2FA,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    transactionID: expect.any(String),
  });

  invariant('transactionID' in result);

  const pendingTransaction = pendingTransactionCache.get(result.transactionID);

  expect(pendingTransaction).toStrictEqual({
    action: SecureAction.TwoFactorAuthDisable,
    attempts: 0,
    ipAddress: ctx.ipAddress,
    sessionID: ctx.session?.id,
    target: user.email,
  });
});

test('it returns an error when user does not have 2FA enabled', async () => {
  const user = db.user.create({
    email: 'user@test.com',
  });

  const session = db.session.create({
    userID: user.id,
  });

  const ctx = createMockGQLContext({ session, user });

  const args = {
    input: {
      action: StepUpAction.CHANGE_EMAIL,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: '2FA is not enabled for your account.',
      title: '2FA not enabled',
    },
  });
});

test('it returns an error if unauthorized', async () => {
  const ctx = createMockGQLContext({});

  const args = {
    input: {
      action: StepUpAction.CHANGE_EMAIL,
    },
  };

  await expect(resolve({}, args, ctx)).rejects.toThrow('Unauthorized');
});
