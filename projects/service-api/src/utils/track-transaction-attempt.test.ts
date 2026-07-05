import { expect, test } from 'vitest';
import { SecureAction } from '../types';
import { pendingTransactionCache } from './pending-transaction-cache';
import { trackTransactionAttempt } from './track-transaction-attempt';

function setupTest() {
  pendingTransactionCache.clear();
}

test('it increments the attempt count for a pending transaction', () => {
  setupTest();

  const transactionID = 'test_transaction';

  const initialTransaction = {
    action: SecureAction.ChangePassword,
    attempts: 0,
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'test@example.com',
  };

  pendingTransactionCache.set(transactionID, initialTransaction);

  trackTransactionAttempt(transactionID);

  const updatedTransaction = pendingTransactionCache.get(transactionID);

  expect(updatedTransaction?.attempts).toBe(1);
});

test('it throws an error when transaction is not found', () => {
  setupTest();

  expect(() => trackTransactionAttempt('non_existent')).toThrow('Pending transaction not found');
});

test('it deletes the transaction when max attempts are reached', () => {
  setupTest();

  const transactionID = 'test_transaction';

  const initialTransaction = {
    action: SecureAction.ChangePassword,
    attempts: 4, // One less than MAX_TRANSACTION_ATTEMPTS
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'test@example.com',
  };

  pendingTransactionCache.set(transactionID, initialTransaction);

  trackTransactionAttempt(transactionID);

  expect(pendingTransactionCache.get(transactionID)).toBeUndefined();
});

test('it increments attempts up to max attempts', () => {
  setupTest();

  const transactionID = 'test_transaction';

  const initialTransaction = {
    action: SecureAction.ChangePassword,
    attempts: 0,
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'test@example.com',
  };

  pendingTransactionCache.set(transactionID, initialTransaction);

  // Track 4 attempts (should work)
  for (let i = 0; i < 4; i++) {
    trackTransactionAttempt(transactionID);
  }

  // 5th attempt should delete the transaction
  trackTransactionAttempt(transactionID);

  expect(pendingTransactionCache.get(transactionID)).toBeUndefined();
});
