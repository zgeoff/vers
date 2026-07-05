import { pendingTransactionCache } from './pending-transaction-cache';

const MAX_TRANSACTION_ATTEMPTS = 5;

/**
 * Tracks a transaction attempt and increments the attempt count.
 *
 * If the pending transaction is not found, an error is thrown.
 *
 * If the verification has been attempted too many times, the pending transaction
 * is deleted from the cache.
 */
export function trackTransactionAttempt(transactionID: string) {
  const pendingTransaction = pendingTransactionCache.get(transactionID);

  if (!pendingTransaction) {
    throw new Error('Pending transaction not found');
  }

  if (pendingTransaction.attempts === MAX_TRANSACTION_ATTEMPTS - 1) {
    pendingTransactionCache.delete(transactionID);

    return;
  }

  // increment our attempts by 1
  pendingTransactionCache.set(transactionID, {
    ...pendingTransaction,
    attempts: pendingTransaction.attempts + 1,
  });
}
