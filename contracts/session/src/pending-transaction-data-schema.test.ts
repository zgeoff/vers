import { expect, test } from 'bun:test';
import { PendingTransactionDataSchema } from './pending-transaction-data-schema';

test('it accepts a well-formed pending transaction with a null sessionID', () => {
  const result = PendingTransactionDataSchema.safeParse({
    action: 'ChangePassword',
    attempts: 0,
    expiresAt: new Date(),
    id: 'txn_1',
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'user_1',
  });

  expect(result.success).toBeTrue();
});

test('it rejects an action outside the secure-action enum', () => {
  const result = PendingTransactionDataSchema.safeParse({
    action: 'NotARealAction',
    attempts: 0,
    expiresAt: new Date(),
    id: 'txn_1',
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'user_1',
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['action'] }));
});
