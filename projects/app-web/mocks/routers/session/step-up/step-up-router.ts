import { consumePendingTransaction } from './consume-pending-transaction';
import { consumeTransactionToken } from './consume-transaction-token';
import { createPendingTransaction } from './create-pending-transaction';
import { getPendingTransaction } from './get-pending-transaction';
import { recordFailedAttempt } from './record-failed-attempt';

export const stepUpRouter = {
  consumePendingTransaction,
  consumeTransactionToken,
  createPendingTransaction,
  getPendingTransaction,
  recordFailedAttempt,
};
