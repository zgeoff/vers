import { afterEach, expect, test } from 'vitest';
import { createMockGQLContext } from '../test-utils/create-mock-gql-context';
import { SecureAction } from '../types';
import { createPendingTransaction } from './create-pending-transaction';
import { pendingTransactionCache } from './pending-transaction-cache';

afterEach(() => {
  pendingTransactionCache.clear();
});

test('it creates a new transaction ID and stores it in the cache', () => {
  const ctx = createMockGQLContext({
    ipAddress: '127.0.0.1',
    requestID: 'test',
  });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.TwoFactorAuth,
      sessionID: null,
      target: 'test',
    },
    ctx,
  );

  const pendingTransaction = pendingTransactionCache.get(transactionID);

  expect(pendingTransaction).toStrictEqual({
    action: SecureAction.TwoFactorAuth,
    attempts: 0,
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'test',
  });
});

test('it throws an error if a pending transaction already exists', () => {
  const ctx = createMockGQLContext({
    ipAddress: '127.0.0.1',
    requestID: 'test',
  });

  createPendingTransaction(
    {
      action: SecureAction.TwoFactorAuth,
      sessionID: null,
      target: 'test',
    },
    ctx,
  );

  expect(() =>
    createPendingTransaction(
      {
        action: SecureAction.TwoFactorAuth,
        sessionID: null,
        target: 'test',
      },
      ctx,
    ),
  ).toThrow('Only one pending transaction is allowed per request');
});
